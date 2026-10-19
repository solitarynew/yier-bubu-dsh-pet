#!/usr/bin/env python3
"""Fetch only source PNG packs from the attributed, pinned upstream commit."""
import json
from pathlib import Path, PurePosixPath
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def main():
    source = next(s for s in json.loads((ROOT/'sources.json').read_text()) if s['name'] == 'YierPet')
    commit = source['commit']
    target = ROOT/'sources/YierPet'
    if (target/'Assets/Packs/duo/meta.json').exists():
        print('原始素材已存在：', target)
        return
    url = f'https://codeload.github.com/xiaojieshi-bot/YierPet/zip/{commit}'
    with tempfile.TemporaryDirectory() as temporary:
        archive = Path(temporary)/'source.zip'
        print('下载固定源版本：', commit)
        urllib.request.urlretrieve(url, archive)
        with zipfile.ZipFile(archive) as zipped:
            for entry in zipped.infolist():
                parts = PurePosixPath(entry.filename).parts
                if len(parts) < 2 or any(p in ('.', '..') for p in parts):
                    continue
                relative = PurePosixPath(*parts[1:])
                if not (str(relative).startswith('Assets/Packs/') or str(relative) in ['README.md', 'LICENSE']):
                    continue
                if entry.is_dir():
                    continue
                output = target.joinpath(*relative.parts)
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_bytes(zipped.read(entry))
    print('素材已就绪：', target)


if __name__ == '__main__':
    main()
