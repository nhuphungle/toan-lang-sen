// Điểm vào ứng dụng: trạng thái, điều hướng, đồng hồ học, nhắc nghỉ mắt, đăng ký service worker.
import { h, clear } from './dom.js';
import { loadState, saveState } from './storage.js';
import { validateBank, LIMITS } from './content-schema.js';
import { PlayClock, todayKey } from './play-clock.js';
import { play } from './audio.js';
import { welcomeScreen } from './screens/welcome.js';
import { mapScreen } from './screens/map.js';
import { lessonScreen } from './screens/lesson.js';
import { farmScreen } from './screens/farm.js';
import { parentScreen } from './screens/parent.js';

const root = document.getElementById('app');
const screens = { welcome: welcomeScreen, map: mapScreen, lesson: lessonScreen, farm: farmScreen, parent: parentScreen };

/** localStorage có thể ném lỗi ngay khi truy cập (chế độ riêng tư/chặn cookie) -> dự phòng bằng bộ nhớ tạm. */
function getStorage() {
  try {
    const s = globalThis.localStorage;
    s.getItem('tls.probe');
    return s;
  } catch {
    const m = new Map();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }
}
const storage = getStorage();

const ctx = {
  storage,
  state: loadState(storage),
  templates: [],
  clock: null,
  current: 'welcome',
  save() {
    saveState(storage, ctx.state);
  },
  sound: (name) => play(name, ctx.state.settings.sound),
  go(name, args) {
    ctx.current = name;
    clear(root);
    const view = screens[name](ctx, args);
    root.append(view);
    const focusTarget = view.querySelector('[data-autofocus]') || view.querySelector('h1,h2');
    if (focusTarget) {
      focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    }
    window.scrollTo(0, 0);
  },
  /** Cộng phút học vào ngày hôm nay (lưu tối đa 60 ngày gần nhất). */
  flushMinutes() {
    const m = ctx.clock.drainMinutes();
    if (m <= 0) return;
    const k = todayKey();
    ctx.state.daily[k] = Math.min(24 * 60, (ctx.state.daily[k] || 0) + m);
    const keys = Object.keys(ctx.state.daily).sort();
    for (const old of keys.slice(0, Math.max(0, keys.length - 60))) delete ctx.state.daily[old];
    ctx.save();
  },
};

function showBreak() {
  if (document.getElementById('break-overlay')) return;
  const overlay = h(
    'div',
    { id: 'break-overlay', class: 'overlay', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'break-title' },
    h('div', { class: 'dialog' }, [
      h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, '👀'),
      h('h2', { id: 'break-title' }, 'Nghỉ mắt một chút nhé!'),
      h('p', null, 'Bé nhìn ra xa, chỗ có cây xanh, trong 20 giây rồi quay lại học tiếp.'),
      h('button', {
        class: 'btn primary', 'data-autofocus': true, type: 'button',
        onClick: () => { ctx.clock.acknowledgeBreak(); overlay.remove(); },
      }, 'Mình nghỉ xong rồi'),
    ]),
  );
  document.body.append(overlay);
  overlay.querySelector('button').focus();
}

function startClock() {
  ctx.clock = new PlayClock({ breakMinutes: ctx.state.settings.breakMinutes });
  const touch = () => ctx.clock.interact(Date.now());
  ['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, touch, { passive: true }));
  touch();
  setInterval(() => {
    if (document.hidden) return;
    if (ctx.clock.tick(Date.now()) && ctx.current !== 'parent') showBreak();
  }, 1000);
  setInterval(() => ctx.flushMinutes(), 30_000);
  addEventListener('visibilitychange', () => { if (document.hidden) ctx.flushMinutes(); });
  addEventListener('pagehide', () => ctx.flushMinutes());
}

async function loadTemplates() {
  const res = await fetch('data/lop1.json', { credentials: 'omit' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  if (text.length > LIMITS.maxFileBytes) throw new Error('Tệp bài học quá lớn');
  const { templates, errors } = validateBank(JSON.parse(text));
  if (errors.length) console.warn('Một số template bị loại:', errors);
  if (!templates.length) throw new Error('Không có bài học hợp lệ');
  return templates;
}

async function main() {
  try {
    ctx.templates = await loadTemplates();
  } catch (e) {
    root.append(h('main', { class: 'screen' }, h('h1', null, 'Chưa tải được bài học'), h('p', null, 'Bé nhờ bố mẹ kiểm tra kết nối rồi tải lại trang nhé.')));
    console.error(e);
    return;
  }
  startClock();
  ctx.go(ctx.state.profile.nickname ? 'map' : 'welcome');

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

main();
