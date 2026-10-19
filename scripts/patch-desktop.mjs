/** Version-gated, idempotent desktop-only patch. Upstream originals are retained. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '/* YIER_BUBU_DESKTOP_MENU_V1 */';

export async function applyDesktopPatch() {
  const packageRoot = path.join(ROOT, 'node_modules/dsh-pet');
  const metadata = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  if (metadata.version !== '0.3.7') throw Error('桌面菜单补丁仅验证过 dsh-pet@0.3.7，请勿自动升级框架');
  const helper = path.join(packageRoot, 'runtime/electron-helper');
  const originals = path.join(helper, '.yier-originals');
  await fs.mkdir(originals, { recursive: true });
  for (const name of ['sprite.js', 'preload.js', 'index.html']) {
    const file = path.join(helper, name);
    const current = await fs.readFile(file, 'utf8');
    let base;
    if (current.includes(MARKER)) base = await fs.readFile(path.join(originals, name), 'utf8');
    else { base = current; await fs.writeFile(path.join(originals, name), base); }
    let next;
    if (name === 'sprite.js') {
      const treeAnchor = 'const tree = tools.concat(S.buildMenuTree(this.animations));';
      const mountAnchor = 'this.menuClose = m.close;';
      const actionAnchor = "if (!leaf || typeof leaf !== 'object') return;";
      for (const anchor of [treeAnchor, actionAnchor, mountAnchor]) {
        if (base.split(anchor).length !== 2) throw Error(`框架菜单代码不匹配：${name}，已停止打补丁`);
      }
      next = MARKER + '\n' + base.replace(treeAnchor,
        'const tree = window.YierMenu.build(this, S.buildMenuTree(this.animations));')
        .replace(actionAnchor, actionAnchor + '\n    if (window.YierMenu.handle(this, leaf)) return;')
        .replace(mountAnchor, 'window.YierMenu.decorate(m.el);\n    ' + mountAnchor);
    } else if (name === 'preload.js') {
      next = MARKER + '\n' + base + "\nrequire('./yier-menu-preload.cjs');\n";
    } else {
      const anchor = '<script src="./sprite.js"></script>';
      if (base.split(anchor).length !== 2) throw Error('框架 HTML 加载顺序不匹配，已停止打补丁');
      next = base.replace(anchor, anchor + '\n    <!-- ' + MARKER + ' -->\n' +
        '    <script src="./yier-menu-model.js"></script>\n' +
        '    <script src="./yier-menu-addon.js"></script>\n' +
        '    <script src="./yier-interaction-addon.js"></script>');
    }
    if (current !== next) await fs.writeFile(file, next);
  }
  for (const [source, target] of [['menu-model.js', 'yier-menu-model.js'],
    ['menu-addon.js', 'yier-menu-addon.js'], ['interaction-addon.js', 'yier-interaction-addon.js'], ['menu-preload.cjs', 'yier-menu-preload.cjs']]) {
    await fs.copyFile(path.join(ROOT, 'desktop', source), path.join(helper, target));
  }
}
