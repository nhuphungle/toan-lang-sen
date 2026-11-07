import { h } from '../dom.js';
import { AVATARS, AVATAR_INFO } from '../rewards.js';
import { sanitizeNickname } from '../storage.js';

export function welcomeScreen(ctx) {
  let avatar = ctx.state.profile.avatar;
  const err = h('p', { class: 'error', role: 'alert' });
  const input = h('input', {
    id: 'nick', type: 'text', maxlength: '20', autocomplete: 'off', placeholder: 'Ví dụ: Bé Na', 'data-autofocus': true,
    'aria-describedby': 'nick-help',
  });

  const avatarBtns = AVATARS.map((id) => {
    const b = h('button', { type: 'button', class: 'avatar-btn', 'aria-pressed': String(id === avatar), onClick: () => {
      avatar = id;
      avatarBtns.forEach((x, i) => x.setAttribute('aria-pressed', String(AVATARS[i] === id)));
      ctx.sound('tap');
    } }, [h('span', { class: 'avatar-emoji', 'aria-hidden': 'true' }, AVATAR_INFO[id].emoji), h('span', null, AVATAR_INFO[id].name)]);
    return b;
  });

  const start = () => {
    const nickname = sanitizeNickname(input.value);
    if (!nickname) { err.textContent = 'Bé nhập tên của mình nhé (chữ cái hoặc số).'; input.focus(); return; }
    ctx.state.profile = { nickname, avatar };
    ctx.save();
    ctx.sound('win');
    ctx.go('map');
  };
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault(); // tránh Enter "rơi" sang nút vừa nhận focus ở màn hình kế tiếp (tự vào bài học)
    start();
  });

  return h('main', { class: 'screen welcome' }, [
    h('div', { class: 'lotus', 'aria-hidden': 'true' }, '🪷'),
    h('h1', null, 'Toán Làng Sen'),
    h('p', { class: 'slogan' }, 'Chạm bài toán thật – Bật sáng tư duy'),
    h('label', { for: 'nick' }, 'Tên của bé là gì?'),
    input,
    h('p', { id: 'nick-help', class: 'help' }, 'Chỉ dùng tên gọi ở nhà, không cần tên thật hay thông tin cá nhân.'),
    h('fieldset', { class: 'avatars' }, [h('legend', null, 'Chọn bạn đồng hành'), h('div', { class: 'row' }, avatarBtns)]),
    err,
    h('button', { class: 'btn primary big', type: 'button', onClick: start }, 'Bắt đầu hành trình'),
    h('p', { class: 'fine' }, 'Không quảng cáo • Dữ liệu chỉ lưu trên thiết bị này'),
  ]);
}
