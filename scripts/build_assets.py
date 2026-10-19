#!/usr/bin/env python3
"""Convert attributed PNG sequences into ordinary dsh-pet packs; no generated poses."""
import concurrent.futures
import hashlib
import html
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'sources/YierPet/Assets/Packs'
PACKS = ROOT / 'packs'
LABELS = {
    's01_shengqi': '气鼓鼓', 's02_tiaowu': '围巾舞', 's04_xianyu': '咸鱼躺平',
    's07_chifan': '吃饭团', 's08_baozhentou': '抱枕头', 's09_zuozhe': '坐着发呆',
    's11_tiaosheng': '跳绳', 's14_fadai': '歪头发呆', 's15_kaodian': '靠垫休息',
    's16_qima': '骑木马', 's17_qiche': '骑小车', 's19_haolei': '好累呀',
    's21_xingli': '收拾行李', 's23_shengqi2': '叉腰生气', 's24_wanjuche': '玩具车',
    's26_wanshouji': '躺着玩手机', 's28_fenpu2': '扑粉打扮', 's44_maohuo': '头顶冒火',
    's45_baonu': '气到跺脚', 's46_zhaohuo': '红温着火', 's47_bixin': '比心',
    's50_dadianna': '打电脑', 's51_aoaoku': '嗷嗷哭', 's03_liuhan': '擦汗',
    's05_chilingshi': '吃零食', 's06_shenlanyao': '伸懒腰', 's10_zuozhe': '坐着发呆',
    's12_tiaosheng': '跳绳', 's20_haolei': '好累呀', 's22_xingli': '收拾行李',
    's25_wanjuche': '玩具车', 's27_wanshouji': '躺着玩手机', 's29_weiqu': '委屈巴巴',
    's42_sahua': '撒花', 's43_daku': '大哭', 's49_hekafei': '喝咖啡打电脑',
    's52_zhanli': '摇摇晃晃', 's53_shouji': '看一二照片', 's13_baobao': '抱抱',
    's30_qitou-bixin': '骑头比心', 's32_qibei': '背着一二', 's34_qinqin': '亲亲',
    's36_zipai': '一起自拍', 's37_dieluohan': '叠罗汉', 's38_diandongche': '一起骑车',
    's39_tangzhe-shuaji': '一起躺着玩手机', 's40_mianduimian': '面对面',
    's48_beihoubao': '背后抱', 's55_linlanzi': '一起拎篮子',
}
NAMES = {'yier': '一二', 'bubu': '布布', 'duo': '一二布布'}
EXCLUDED = {'s18_huabanche': '素材含整条街道路面，作为透明桌宠出现矩形场景。'}


def render_clip(task):
    pack, entry = task
    key, count, fps = entry['id'], entry['frames'], entry['fps']
    source = SOURCE / pack / key
    frames = [Image.open(source / f'frame_{i:03d}.png').convert('RGBA') for i in range(count)]
    # One transform for the ENTIRE clip: never crop/scale each frame separately.
    boxes = [im.getchannel('A').point(lambda x: 255 if x > 8 else 0).getbbox() for im in frames]
    if not all(boxes):
        raise ValueError(f'{pack}/{key}: empty frame')
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes),
           max(b[2] for b in boxes), max(b[3] for b in boxes))
    w, h = box[2] - box[0], box[3] - box[1]
    scale = min(236 / w, 258 / h)
    size = (round(w * scale), round(h * scale))
    dest = ((640 - size[0]) // 2, 330 - size[1])
    target = PACKS / f'{pack}-animation' / f'{LABELS[key]}.webm'
    target.parent.mkdir(parents=True, exist_ok=True)
    # Repeat source cycles to keep dsh-pet's random scheduler calm (4-8 s clips).
    loops = max(1, round(5 * fps / count))
    with tempfile.TemporaryDirectory(prefix='yier-dsh-') as tmp:
        for i, im in enumerate(frames):
            sprite = im.crop(box).resize(size, Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', (640, 360), (0, 0, 0, 0))
            canvas.alpha_composite(sprite, dest)
            canvas.save(Path(tmp) / f'frame_{i:03d}.png')
            if i == 0:
                poster = ROOT / 'review/posters' / pack / f'{key}.png'
                poster.parent.mkdir(parents=True, exist_ok=True)
                canvas.save(poster)
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                        '-stream_loop', str(loops - 1), '-framerate', str(fps),
                        '-i', str(Path(tmp) / 'frame_%03d.png'), '-an',
                        '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0',
                        '-lossless', '1', '-deadline', 'good', '-cpu-used', '4', '-threads', '2',
                        str(target)], check=True)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    return {'pack': pack, 'sourceId': key, 'name': LABELS[key], 'tags': entry['tags'],
            'sourceFrames': count, 'fps': fps, 'loops': loops,
            'duration': loops * count / fps, 'crop': box, 'scale': scale,
            'file': str(target.relative_to(ROOT)), 'sha256': digest}


def make_config(pack, rows):
    by_id = {r['sourceId']: r['name'] for r in rows}
    choose = lambda ids: [by_id[i] for i in ids if i in by_id]
    idle = choose({'yier': ['s09_zuozhe', 's14_fadai'],
                   'bubu': ['s10_zuozhe', 's52_zhanli'],
                   'duo': ['s40_mianduimian', 's13_baobao']}[pack])
    clicks = choose({'yier': ['s47_bixin', 's02_tiaowu', 's08_baozhentou'],
                     'bubu': ['s42_sahua', 's53_shouji'],
                     'duo': ['s13_baobao', 's34_qinqin', 's48_beihoubao']}[pack])
    drag = choose({'yier': ['s23_shengqi2', 's01_shengqi'],
                   'bubu': ['s29_weiqu', 's03_liuhan'],
                   'duo': ['s32_qibei']}[pack])
    move = choose({'yier': ['s17_qiche', 's16_qima', 's24_wanjuche'],
                   'bubu': ['s25_wanjuche'], 'duo': ['s38_diandongche']}[pack])
    category_tags = [('吃饭休息', {'eat', 'sleep', 'lazy', 'tired'}),
                     ('开心贴贴', {'happy', 'love'}),
                     ('认真干活', {'work', 'exercise'}),
                     ('小情绪', {'sad', 'angry', 'hot'}), ('日常小动作', {'idle'})]
    used, categories = set(), []
    for label, tags in category_tags:
        actions = [r['name'] for r in rows if tags.intersection(r['tags']) and r['name'] not in used]
        if actions:
            categories.append({'id': label, 'weight': 4 if label == '小情绪' else 12, 'actions': actions})
            used.update(actions)
    work = next((r['name'] for r in rows if 'work' in r['tags']), idle[0])
    return {'notificationsEnabled': False,
            'pets': [{'id': pack, 'name': NAMES[pack], 'size': 490,
                      'balanceEnabled': False, 'whisperEnabled': False, 'workStatusEnabled': False,
                      'fixedEnabled': False, 'display': 'both',
                      'position': {'corner': 'bottom-left',
                                   'marginX': {'yier': 20, 'bubu': 390, 'duo': 760}[pack],
                                   'marginY': 35}}],
            'animations': {'idle': idle, 'turn': [idle[0]], 'drag': drag, 'clicks': clicks,
                           'moves': {'default': {'minDist': 65, 'maxDist': 210, 'margin': 20,
                                                'leadSec': 0.3, 'tailSec': 0.3},
                                     'actions': [{'name': n} for n in move]},
                           'categories': categories,
                           'events': {'balance': [idle[0]] * 6,
                                      'workStatus': [idle[0], work, work, idle[0], clicks[0], drag[0]]}},
            'animationWeights': {'idle': 30, 'turn': 3, 'move': 10},
            'eventsRefreshSec': {'balance': 1800, 'whisper': 300}}


def gallery(rows):
    cards = []
    for r in rows:
        cards.append(f'''<article data-pack="{r['pack']}"><video muted loop playsinline controls
          preload="none" poster="posters/{r['pack']}/{r['sourceId']}.png" src="../{html.escape(r['file'])}"></video>
          <h3>{NAMES[r['pack']]} · {html.escape(r['name'])}</h3>
          <small>{r['sourceFrames']} 帧 · {r['fps']} fps · 源动作 {r['sourceId']}</small>
          <button onclick="playPet('{r['pack']}','{r['name']}')">让桌宠做这个动作</button></article>''')
    content = (ROOT / 'review/template.html').read_text(encoding='utf-8').replace('<!-- CARDS -->', '\n'.join(cards))
    (ROOT / 'review/index.html').write_text(content, encoding='utf-8')


def main():
    if not shutil.which('ffmpeg'):
        raise SystemExit('Install ffmpeg first')
    tasks = []
    for pack in NAMES:
        entries = json.loads((SOURCE / pack / 'meta.json').read_text())['stickers']
        tasks.extend((pack, e) for e in entries if e['id'] not in EXCLUDED)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        rows = list(executor.map(render_clip, tasks))
    for pack in NAMES:
        config = make_config(pack, [r for r in rows if r['pack'] == pack])
        (PACKS / f'{pack}-config.json').write_text(json.dumps(config, ensure_ascii=False, indent=2)+'\n')
    (ROOT / 'assets-manifest.json').write_text(json.dumps({'source': 'sources.json',
         'excluded': EXCLUDED, 'animations': rows}, ensure_ascii=False, indent=2)+'\n')
    gallery(rows)
    print(f'Built {len(rows)} transparent VP9 clips and 3 dsh-pet packs.')


if __name__ == '__main__':
    main()
