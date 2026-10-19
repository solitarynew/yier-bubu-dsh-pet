#!/usr/bin/env python3
"""Check real VP9 decoding, alpha, durations, attribution manifest and config references."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def verify_clip(row):
    path = ROOT / row['file']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == row['sha256'], path
    info = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,width,height:stream_tags=alpha_mode',
        '-show_entries', 'format=duration', '-of', 'json', str(path)]))
    stream = info['streams'][0]
    assert (stream['codec_name'], stream['width'], stream['height']) == ('vp9', 640, 360), path
    assert stream.get('tags', {}).get('alpha_mode') == '1', path
    assert abs(float(info['format']['duration']) - row['duration']) < 0.03, path
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', str(path),
        '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'])
    image = Image.frombytes('RGBA', (640, 360), raw)
    assert image.getchannel('A').getextrema() == (0, 255), path
    bbox = image.getchannel('A').getbbox()
    assert bbox and bbox[0] >= 190 and bbox[2] <= 450 and bbox[3] <= 332, (path, bbox)
    return {'file': row['file'], 'duration': info['format']['duration'], 'alpha': True}


def names(a):
    result = set()
    for k in ['idle', 'turn', 'drag', 'clicks']:
        result.update(a[k])
    result.update(r['name'] for r in a['moves']['actions'])
    for category in a['categories']:
        result.update(category['actions'])
    for slots in a['events'].values():
        for slot in slots:
            result.update(slot if isinstance(slot, list) else [slot])
    return result


def main():
    manifest = json.loads((ROOT/'assets-manifest.json').read_text())
    rows = manifest['animations']
    assert len(rows) == 49
    for pack, expected in [('yier', 23), ('bubu', 15), ('duo', 11)]:
        conf = json.loads((ROOT/'packs'/f'{pack}-config.json').read_text())
        packrows = [r for r in rows if r['pack'] == pack]
        assert len(packrows) == expected
        assert names(conf['animations']) == {r['name'] for r in packrows}
        assert not conf['pets'][0]['whisperEnabled']
        assert not conf['pets'][0]['balanceEnabled']
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        checks = list(executor.map(verify_clip, rows))
    report = {'passed': True, 'clips': len(checks), 'framework': 'dsh-pet@0.3.7',
              'checks': ['manifest hashes', 'all menu references', 'VP9 codec', '640x360 canvas',
                         'source-derived duration', 'actual decoded alpha channel', 'body within hit box'],
              'results': checks}
    (ROOT/'review/verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(f'PASS: {len(checks)} real decoded alpha videos; all 3 pack references complete.')


if __name__ == '__main__':
    main()
