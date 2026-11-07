// Nhân vật của bé kèm đồ đang mặc (nón, áo). Chỉ là hiển thị; trạng thái nằm trong state.farm.outfit.
import { h } from './dom.js';
import { AVATAR_INFO, findItem } from './rewards.js';

export function avatarView(state, cls = '') {
  const av = AVATAR_INFO[state.profile.avatar] || Object.values(AVATAR_INFO)[0];
  const { hat, top } = state.farm.outfit;
  return h('span', { class: `avatar-wrap ${cls}`.trim(), 'aria-hidden': 'true' }, [
    h('span', { class: 'avatar-emoji' }, av.emoji),
    hat ? h('span', { class: 'wear-hat' }, findItem(hat).emoji) : null,
    top ? h('span', { class: 'wear-top' }, findItem(top).emoji) : null,
  ]);
}
