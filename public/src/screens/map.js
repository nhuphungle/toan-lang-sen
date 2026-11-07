import { h } from '../dom.js';
import { avatarView } from '../avatar.js';
import { levelFromXp, LEVEL_XP } from '../rewards.js';

const REGIONS = [
  { id: 'bac-bo', emoji: '🏘️', name: 'Đồng bằng Bắc Bộ', desc: 'Chợ quê của mẹ: đếm, cộng, trừ, nhận biết hình', open: true },
  { id: 'tay-bac', emoji: '⛰️', name: 'Vùng cao Tây Bắc', desc: 'Ruộng bậc thang – sắp ra mắt', open: false },
  { id: 'mien-trung', emoji: '🏮', name: 'Dải đất Miền Trung', desc: 'Đèn hoa đăng Hội An – sắp ra mắt', open: false },
  { id: 'mien-tay', emoji: '🛶', name: 'Miền Tây sông nước', desc: 'Chợ nổi Cái Răng – sắp ra mắt', open: false },
];

export function mapScreen(ctx) {
  const { state } = ctx;
  const lvl = levelFromXp(state.xp);
  const into = state.xp % LEVEL_XP;

  const cards = REGIONS.map((r) =>
    h('li', { class: 'region' + (r.open ? '' : ' locked') }, [
      h('span', { class: 'region-emoji', 'aria-hidden': 'true' }, r.open ? r.emoji : '🔒'),
      h('div', { class: 'region-body' }, [h('h2', null, r.name), h('p', null, r.desc)]),
      r.open
        ? h('button', { class: 'btn primary', type: 'button', 'data-autofocus': true, onClick: () => { ctx.sound('tap'); ctx.go('lesson'); } }, 'Vào chơi')
        : h('span', { class: 'tag', 'aria-label': 'Chưa mở' }, 'Sắp mở'),
    ]),
  );

  return h('main', { class: 'screen map' }, [
    h('header', { class: 'topbar' }, [
      h('div', { class: 'who' }, [
        avatarView(state),
        h('div', null, [h('strong', null, state.profile.nickname), h('div', { class: 'small' }, `Cấp ${lvl} • ${state.xp} XP • ${state.coins} xu`)]),
      ]),
      h('div', { class: 'xpbar', role: 'progressbar', 'aria-label': 'Tiến độ lên cấp', 'aria-valuemin': '0', 'aria-valuemax': String(LEVEL_XP), 'aria-valuenow': String(into) },
        h('div', { class: 'xpfill', vars: { '--w': `${into}%` } })),
    ]),
    h('h1', null, 'Bản đồ làng nghề'),
    h('ul', { class: 'regions' }, cards),
    h('nav', { class: 'row menu', 'aria-label': 'Menu' }, [
      h('button', { class: 'btn', type: 'button', onClick: () => ctx.go('farm') }, '🌾 Nông trại ước mơ'),
      h('button', { class: 'btn', type: 'button', onClick: () => ctx.go('parent') }, '👨‍👩‍👧 Góc phụ huynh'),
    ]),
    state.badges.length
      ? h('p', { class: 'small' }, `Huy hiệu: ${state.badges.length}`)
      : null,
  ]);
}
