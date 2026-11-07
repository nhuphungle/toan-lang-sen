import { h, svg } from '../dom.js';
import { hashPin, verifyPin, pinSupported, PIN_RE, isLocked, registerFailure, registerSuccess } from '../pin.js';
import { MAX_RAW_BYTES, exportData, importData, clearState, defaultState } from '../storage.js';
import { todayKey } from '../play-clock.js';

const SKILL_LABEL = { calc: 'Tính nhanh', space: 'Tư duy không gian', word: 'Giải toán có lời văn' };
const SKILL_SHORT = { calc: 'Tính nhanh', space: 'Không gian', word: 'Lời văn' }; // nhãn ngắn trên biểu đồ

const FAMILY_TIPS = [
  'Hôm nay khi dắt bé đi chợ hoặc siêu thị, bố mẹ hãy đố bé tìm 3 món đồ có giá dưới 20.000đ, rồi cùng cộng xem tổng cộng hết bao nhiêu.',
  'Khi bé tính cộng, hãy để bé tự đếm tiếp từ số lớn (ví dụ 7 + 3: bắt đầu từ 7 rồi đếm thêm 3). Hỏi "con làm thế nào?" thay vì đưa ngay đáp án.',
  'Cùng bé xếp đồ trong nhà theo hình dạng: đĩa tròn, khăn vuông, hộp chữ nhật. Hỏi bé vì sao con xếp vậy.',
  'Nếu cách dạy ở nhà khác cách cô giáo dạy, bố mẹ đừng vội sửa. Hãy hỏi bé "ở lớp cô dạy con thế nào?" rồi cùng làm theo cách đó.',
  'Khi bé làm sai, hãy khen sự cố gắng trước, rồi dùng gợi ý hình ảnh (vẽ, xếp đồ vật) thay vì giải hộ.',
];

function radar(values) {
  const keys = Object.keys(SKILL_LABEL);
  const cx = 160, cy = 104, R = 66;
  const pt = (i, f) => {
    const a = (-Math.PI / 2) + (i * 2 * Math.PI) / keys.length;
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };
  const poly = (f) => keys.map((_, i) => pt(i, f).map((n) => n.toFixed(1)).join(',')).join(' ');
  const data = keys.map((k, i) => pt(i, Math.max(0.03, values[k])).map((n) => n.toFixed(1)).join(',')).join(' ');
  return svg('svg', { viewBox: '0 0 320 230', width: '100%', role: 'img', 'aria-label': 'Biểu đồ năng lực: ' + keys.map((k) => `${SKILL_LABEL[k]} ${Math.round(values[k] * 100)}%`).join(', ') }, [
    ...[0.33, 0.66, 1].map((f) => svg('polygon', { points: poly(f), fill: 'none', stroke: '#c9b9a3', 'stroke-width': '1' })),
    svg('polygon', { points: data, fill: '#e86a92', opacity: '0.45', stroke: '#c2406c', 'stroke-width': '2' }),
    ...keys.flatMap((k, i) => {
      const [x, y] = pt(i, 1.22);
      const anchor = x > cx + 5 ? 'start' : x < cx - 5 ? 'end' : 'middle';
      const y0 = y + (i === 0 ? -14 : 8);
      const at = { x: x.toFixed(1), 'text-anchor': anchor, fill: '#3a2e28' };
      return [svg('text', { ...at, y: y0.toFixed(1) }, SKILL_SHORT[k]), svg('text', { ...at, y: (y0 + 15).toFixed(1) }, `${Math.round(values[k] * 100)}%`)];
    }),
  ]);
}

export function parentScreen(ctx) {
  const { state } = ctx;
  const root = h('main', { class: 'screen parent' });
  const back = h('button', { class: 'btn link', type: 'button', onClick: () => ctx.go('map') }, '← Về bản đồ');

  function gate() {
    const setup = !state.parent.pin;
    const err = h('p', { class: 'error', role: 'alert' });
    const pin = h('input', { id: 'pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '8', 'data-autofocus': true, 'aria-describedby': 'pin-help' });
    const pin2 = setup ? h('input', { id: 'pin2', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '8' }) : null;

    const submit = async () => {
      err.textContent = '';
      if (!pinSupported()) {
        err.textContent = 'Trình duyệt chặn tính năng mã hoá vì trang đang mở bằng http. Hãy mở game bằng địa chỉ https:// để tạo PIN.';
        return;
      }
      try { await submitInner(); } catch { err.textContent = 'Có lỗi khi xử lý PIN. Hãy tải lại trang và thử lại.'; }
    };
    const submitInner = async () => {
      const now = Date.now();
      if (!setup && isLocked(state.parent, now)) {
        err.textContent = `Đã khoá tạm. Thử lại sau ${Math.ceil((state.parent.lockedUntil - now) / 1000)} giây.`;
        return;
      }
      if (!PIN_RE.test(pin.value)) { err.textContent = 'PIN gồm 4 đến 8 chữ số.'; return; }
      if (setup) {
        if (pin.value !== pin2.value) { err.textContent = 'Hai lần nhập PIN chưa giống nhau.'; return; }
        state.parent = { pin: await hashPin(pin.value), failed: 0, lockedUntil: 0 };
        ctx.save();
        return dashboard();
      }
      if (await verifyPin(pin.value, state.parent.pin)) {
        state.parent = registerSuccess(state.parent);
        ctx.save();
        return dashboard();
      }
      state.parent = registerFailure(state.parent, Date.now());
      ctx.save();
      err.textContent = isLocked(state.parent, Date.now()) ? 'Sai PIN quá nhiều lần. Đã khoá tạm 1 phút trở lên.' : 'PIN chưa đúng.';
      pin.value = '';
    };
    pin.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });

    root.replaceChildren(back, h('h1', null, 'Góc phụ huynh'), h('div', { class: 'card' }, [
      h('p', { id: 'pin-help', class: 'help' }, setup
        ? 'Tạo mã PIN 4–8 chữ số để bảo vệ khu vực này. PIN chỉ lưu (dạng băm) trên thiết bị này; nếu quên, bố mẹ có thể xoá dữ liệu trình duyệt để đặt lại.'
        : 'Nhập PIN phụ huynh để xem báo cáo.'),
      h('label', { for: 'pin' }, setup ? 'Tạo PIN' : 'PIN'), pin,
      setup ? [h('label', { for: 'pin2' }, 'Nhập lại PIN'), pin2] : null,
      err,
      h('button', { class: 'btn primary', type: 'button', onClick: submit }, setup ? 'Tạo PIN' : 'Mở khoá'),
    ]));
  }

  function dashboard() {
    const st = state.stats;
    const acc = st.totalAnswered ? Math.round((100 * st.totalCorrect) / st.totalAnswered) : 0;
    const values = Object.fromEntries(Object.keys(SKILL_LABEL).map((k) => {
      const s = st.bySkill[k]; return [k, s.total ? s.correct / s.total : 0];
    }));
    const today = state.daily[todayKey()] || 0;
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return todayKey(d); });
    const week = days.map((k) => state.daily[k] || 0);
    const maxW = Math.max(10, ...week);
    const tip = FAMILY_TIPS[Math.floor(Date.now() / 86_400_000) % FAMILY_TIPS.length];

    const breakSel = h('select', { id: 'brk' }, [10, 15, 20, 25, 30].map((m) => h('option', { value: String(m), selected: m === state.settings.breakMinutes }, `${m} phút`)));
    breakSel.addEventListener('change', () => { state.settings.breakMinutes = Number(breakSel.value); ctx.clock.breakMs = state.settings.breakMinutes * 60_000; ctx.save(); });
    const sound = h('input', { id: 'snd', type: 'checkbox', checked: state.settings.sound });
    sound.addEventListener('change', () => { state.settings.sound = sound.checked; ctx.save(); });

    const impMsg = h('p', { class: 'error', role: 'alert' });
    const imp = h('input', { id: 'imp', type: 'file', accept: 'application/json,.json' });
    imp.addEventListener('change', async () => {
      impMsg.textContent = '';
      const file = imp.files && imp.files[0];
      if (!file) return;
      const next = file.size <= MAX_RAW_BYTES ? importData(await file.text(), state) : null;
      imp.value = '';
      if (!next) { impMsg.textContent = 'Tệp không hợp lệ. Hãy chọn tệp JSON đã tải từ Toán Làng Sen.'; return; }
      if (!window.confirm('Khôi phục sẽ GHI ĐÈ tiến độ hiện tại của bé trên thiết bị này. Tiếp tục?')) return;
      ctx.state = next;
      ctx.save();
      location.reload();
    });

    const del = h('input', { id: 'del', type: 'text', autocomplete: 'off', placeholder: 'Gõ XOA để xác nhận' });
    const delMsg = h('p', { class: 'error', role: 'alert' });

    root.replaceChildren(
      back,
      h('h1', { 'data-autofocus': true }, `Báo cáo của ${state.profile.nickname || 'bé'}`),
      h('section', { class: 'card' }, [
        h('h2', null, 'Tổng quan'),
        h('ul', { class: 'stats' }, [
          h('li', null, [h('strong', null, String(st.totalAnswered)), ' câu đã làm']),
          h('li', null, [h('strong', null, `${acc}%`), ' đúng ngay lần đầu']),
          h('li', null, [h('strong', null, String(st.lessonsDone)), ' bài học']),
          h('li', null, [h('strong', null, `${today} phút`), ' hôm nay']),
        ]),
        h('h2', null, '7 ngày gần nhất (phút học)'),
        h('div', { class: 'bars', role: 'img', 'aria-label': 'Phút học 7 ngày gần nhất: ' + week.join(', ') },
          week.map((m, i) => h('div', { class: 'bar-col' }, [h('div', { class: 'bar', vars: { '--h': `${Math.round((m / maxW) * 100)}%` } }), h('span', { class: 'small' }, days[i].slice(5))]))),
      ]),
      h('section', { class: 'card' }, [h('h2', null, 'Bản đồ năng lực'), radar(values),
        st.totalAnswered < 10 ? h('p', { class: 'help' }, 'Cần thêm vài bài học để biểu đồ phản ánh đúng.') : null]),
      h('section', { class: 'card' }, [h('h2', null, 'Gợi ý sư phạm gia đình hôm nay'), h('p', null, tip)]),
      h('section', { class: 'card' }, [
        h('h2', null, 'Cài đặt'),
        h('label', { for: 'brk' }, 'Nhắc nghỉ mắt sau'), breakSel,
        h('label', { class: 'inline', for: 'snd' }, [sound, ' Bật âm thanh']),
      ]),
      h('section', { class: 'card' }, [
        h('h2', null, 'Dữ liệu của bé'),
        h('p', { class: 'help' }, 'Toàn bộ dữ liệu chỉ nằm trên thiết bị này. Không có quảng cáo hay theo dõi bên thứ ba.'),
        h('button', { class: 'btn', type: 'button', onClick: () => {
          const blob = new Blob([exportData(state)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = h('a', { class: 'sr-only' }); a.href = url; a.download = 'toan-lang-sen-du-lieu.json';
          document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        } }, 'Tải dữ liệu (JSON)'),
        h('p', { class: 'help' }, 'Dùng tệp này để chuyển tiến độ sang thiết bị khác hoặc sao lưu. PIN phụ huynh không nằm trong tệp.'),
        h('label', { for: 'imp' }, 'Khôi phục từ tệp sao lưu'), imp, impMsg,
        h('label', { for: 'del' }, 'Xoá toàn bộ dữ liệu'), del, delMsg,
        h('button', { class: 'btn danger', type: 'button', onClick: () => {
          if (del.value.trim().toUpperCase() !== 'XOA') { delMsg.textContent = 'Hãy gõ XOA để xác nhận.'; return; }
          clearState(ctx.storage);
          ctx.state = defaultState();
          location.reload();
        } }, 'Xoá tất cả'),
      ]),
    );
    root.querySelector('h1').focus();
  }

  gate();
  return root;
}
