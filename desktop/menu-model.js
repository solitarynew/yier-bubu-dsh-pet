(function (root) {
  'use strict';
  const MODES = { pair: '双人版（两个独立实例）', duo: '组合版（一个同框实例）' };
  const checked = (label, value) => (value ? '✓ ' : '　 ') + label;
  function actionGroups(animations) {
    const seen = new Set();
    const groups = [];
    function add(label, names) {
      const children = names.filter(name => {
        if (seen.has(name)) return false;
        seen.add(name); return true;
      }).map(name => ({ label: name, anim: name }));
      if (children.length) groups.push({ label, children });
    }
    add('移动', animations.moves.actions.map(item => item.name));
    for (const category of animations.categories || []) add(category.id, category.actions);
    add('其他动作', [...animations.idle, ...animations.turn, ...animations.drag, ...animations.clicks]);
    return [{ label: '动作', children: groups }];
  }
  function markActions(nodes, selected) {
    return nodes.map(node => node.children
      ? { ...node, children: markActions(node.children, selected) }
      : { ...node, label: checked(node.label, Boolean(selected && node.anim === selected)) });
  }
  function build({ mode, pinned, anim, roam, size = 490, interactionEnabled = true, interactionStyle = 'mixed', statusSync = {}, animations, actionTree }) {
    const actions = markActions(animations ? actionGroups(animations) : actionTree, pinned || anim);
    if (actions[0]) actions[0].label = pinned ? `动作 · 已选：${pinned}` : `动作 · 当前：${anim}`;
    return [
      { label: `启动模式 · ${mode === 'duo' ? '组合版' : '双人版'}`, children: Object.entries(MODES).map(([key, label]) =>
        ({ label: checked(label, mode === key), action: 'yier-mode-' + key })) },
      { label: `大小 · ${size}（统一）`, children: [[380, '小'], [490, '中'], [600, '大']].map(([value, label]) =>
        ({ label: checked(label, size === value), action: 'yier-size-' + value })) },
      { label: checked('自动漫游', roam), action: 'yier-roam' },
      ...(mode === 'pair' ? [{ label: checked('靠近互动', interactionEnabled), action: 'yier-interaction' },
        { label: '互动方式', children: [['mixed', '交替（合体＋同步）'], ['duo', '合体双人动作'], ['sync', '同名动作同步']].map(([style, label]) =>
          ({ label: checked(label, style === interactionStyle), action: 'yier-style-' + style })) }] : []),
      { label: '状态同步', children: [['codex','Codex'],['dsh','DSH']].map(([source,label]) =>
        ({label: checked(`同步 ${label} 状态 · ${statusSync[source]?.label || '已关闭'}`,statusSync[source]?.enabled === true),action:'yier-sync-'+source})).concat([{label:'连接设置…',action:'yier-sync-settings'}]) },
      ...actions,
      { label: '回到初始位置', action: 'home' },
      { label: '退出全部桌宠', action: 'yier-quit' },
    ];
  }
  const api = { build, markActions, actionGroups };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YierMenuModel = api;
})(typeof window === 'undefined' ? globalThis : window);
