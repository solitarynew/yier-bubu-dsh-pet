export const SOURCES = ['codex', 'dsh'];
export const STATES = ['idle', 'working', 'waiting', 'success', 'error'];
const PRIORITY = { idle: 0, success: 1, error: 2, working: 3, waiting: 4 };
export const STATE_LABELS = { idle: '空闲', working: '处理中', waiting: '等待确认', success: '本轮结束', error: '出错' };
export function hookState(data) {
  switch (data.hook_event_name) {
    case 'UserPromptSubmit': case 'PreToolUse': case 'PreCompact': case 'PostCompact': return 'working';
    case 'PostToolUse': return data.tool_response?.is_error === true ? 'error' : 'working';
    case 'PermissionRequest': return 'waiting';
    case 'Stop': return 'success';
    case 'Interrupt': case 'SessionEnd': case 'SessionStart': return 'idle';
    default: return null;
  }
}
export function dshStateUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username || url.password || ['17340','17341'].includes(url.port)) throw Error('DSH 地址必须是其它本机 DSH 服务的 HTTP 状态接口');
  return url.href;
}
export function parseDshState(data) {
  const leaf = data?.sections?.workStatus;
  if (!leaf || typeof leaf.counter !== 'number' || !('data' in leaf)) throw Error('此地址没有返回 dsh-pet 状态');
  const state = leaf.data?.state ?? 'idle';
  if (!STATES.includes(state)) throw Error('DSH 返回未知状态');
  return { state, revision: String(leaf.counter) };
}
export class StatusSync {
  constructor({ now = Date.now, staleSeconds = 180, terminalSeconds = 8 } = {}) {
    this.now = now; this.staleMs = staleSeconds * 1000; this.terminalMs = terminalSeconds * 1000;
    this.sources = Object.fromEntries(SOURCES.map(source => [source, { enabled: false, connected: false, seen: 0, message: '已关闭', sessions: new Map() }]));
  }
  enable(source, enabled) {
    const entry = this.sources[source];
    if (!entry || typeof enabled !== 'boolean') throw Error('无效同步设置');
    if (entry.enabled !== enabled) { entry.sessions.clear(); entry.connected = false; entry.seen = 0; }
    entry.enabled = enabled; entry.message = enabled ? (source === 'codex' ? '等待 Codex 事件' : '未连接') : '已关闭';
  }
  push(source, { sessionId = 'current', state, revision = '', timestamp = this.now() }) {
    const entry = this.sources[source];
    if (!entry?.enabled) return false;
    if (!STATES.includes(state) || typeof sessionId !== 'string' || sessionId.length > 200 || !Number.isFinite(timestamp)) throw Error('无效状态事件');
    if (Math.abs(timestamp - this.now()) > 60000) return false;
    const old = entry.sessions.get(sessionId);
    if (old && timestamp < old.timestamp) return false;
    const changed = !old || old.state !== state || old.revision !== revision;
    entry.sessions.set(sessionId, { state, revision, timestamp, changedAt: changed ? this.now() : old.changedAt });
    if (entry.sessions.size > 200) entry.sessions.delete(entry.sessions.keys().next().value);
    entry.connected = true; entry.seen = this.now(); entry.message = '';
    return true;
  }
  disconnect(source, message = '未连接') {
    const entry = this.sources[source]; entry.connected = false; entry.message = message; entry.sessions.clear();
  }
  snapshot() {
    const sources = {}, candidates = [];
    for (const [source, entry] of Object.entries(this.sources)) {
      const recent = entry.connected && this.now() - entry.seen <= this.staleMs;
      let best = { state: 'idle', changedAt: 0 };
      if (entry.enabled && recent) for (const session of entry.sessions.values()) {
        if (this.now() - session.timestamp > this.staleMs) continue;
        if (['success','error'].includes(session.state) && this.now() - session.changedAt > this.terminalMs) continue;
        if (PRIORITY[session.state] > PRIORITY[best.state] ||
          (PRIORITY[session.state] === PRIORITY[best.state] && session.changedAt > best.changedAt)) best = session;
      }
      sources[source] = { enabled: entry.enabled, connected: entry.enabled && recent, state: best.state,
        label: !entry.enabled ? '已关闭' : !recent ? (source === 'codex' ? '等待 Codex 事件' : entry.message || '未连接') : STATE_LABELS[best.state] };
      if (entry.enabled && recent && best.state !== 'idle') candidates.push({ source, ...best });
    }
    candidates.sort((a,b) => PRIORITY[b.state] - PRIORITY[a.state] || b.changedAt - a.changedAt);
    const winner = candidates[0];
    return { sources, display: winner ? { source: winner.source, state: winner.state,
      label: `${winner.source === 'codex' ? 'Codex' : 'DSH'} · ${STATE_LABELS[winner.state]}`,
      key: `${winner.source}:${winner.state}:${winner.changedAt}` } : null };
  }
}
export const STATUS_ACTIONS = {
  yier: { working:'打电脑', waiting:'歪头发呆', success:'比心', error:'气鼓鼓' },
  bubu: { working:'喝咖啡打电脑', waiting:'委屈巴巴', success:'撒花', error:'大哭' },
  duo: { working:'一起躺着玩手机', waiting:'面对面', success:'抱抱', error:'背后抱' },
};
