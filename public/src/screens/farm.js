import { h } from '../dom.js';
import { avatarView } from '../avatar.js';
import { FARM_ITEMS, BADGES, GIFTS, FARM_SLOTS, MAX_STACK, buyItem, harvest, harvestCoins, findItem, countOf, growthStage, msUntilGrown, formatCountdown } from '../rewards.js';

const WEAR_LABEL = { hat: 'Đội', top: 'Mặc' };

export function farmScreen(ctx) {
  const { state } = ctx;
  const root = h('main', { class: 'screen farm' });
  let held = null; // vật bé đang cầm để đặt: { id, at, from } (from = chỉ số ô cũ, -1 nếu lấy từ kho)
  let message = '';
  let timers = []; // cây đang lớn trên màn hình hiện tại: để đồng hồ cập nhật từng giây mà không vẽ lại cả trang
  let harvesting = -1; // ô cây đã chín đang mở bảng thu hoạch

  const placedCount = (id) => state.farm.slots.filter((s) => s && s.id === id).length;
  const available = (id) => countOf(state.inventory, id) - placedCount(id) - (held && held.id === id ? 1 : 0);

  /** Đổi trạng thái, lưu, vẽ lại và trả tiêu điểm bàn phím về đúng nút (không nhảy lên đầu trang). */
  function update(focusKey, msg) {
    message = msg || '';
    ctx.save();
    render();
    const target = (focusKey && root.querySelector(`[data-key="${focusKey}"]:not([disabled])`)) || root.querySelector('h1');
    if (target) { if (!target.matches('button')) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
  }

  const minutesLabel = (ms) => `còn khoảng ${Math.max(1, Math.ceil(ms / 60_000))} phút`;

  function plotView(i) {
    const s = state.farm.slots[i];
    const item = s && findItem(s.id);
    const stage = item ? growthStage(item, s.at, Date.now()) : 0;
    const emoji = item ? (item.stages ? item.stages[stage] : item.emoji) : '';
    const grown = item && item.stages && stage === item.stages.length - 1;
    const egg = item && item.kind === 'egg';
    const ready = grown && item.kind === 'plant'; // chỉ cây chín mới thu hoạch được; gà đã nở thì chỉ đi lại
    const label = !item
      ? `Ô ${i + 1}: trống${held ? '. Bấm để đặt vật đang cầm vào đây' : ''}`
      : ready ? `Ô ${i + 1}: ${item.name}, đã chín. Bấm để thu hoạch`
        : item.stages && !grown ? `Ô ${i + 1}: ${item.name}, ${egg ? 'đang ấp' : 'đang lớn'}, ${minutesLabel(msUntilGrown(item, s.at, Date.now()))}. Bấm để nhấc lên`
          : `Ô ${i + 1}: ${egg ? item.hatchName : item.name}. Bấm để nhấc lên`;
    let countdown = null;
    if (item && item.stages && !grown) {
      const rem = msUntilGrown(item, s.at, Date.now());
      countdown = h('span', { class: 'countdown' + (rem <= 60_000 ? ' soon' : ''), 'aria-hidden': 'true' }, formatCountdown(rem));
    }
    const btn = h('button', {
      class: 'plot' + (!item && held ? ' target' : '') + (ready && !held ? ' ready' : ''), type: 'button', 'aria-label': label, 'data-key': `slot-${i}`,
      onClick: () => {
        harvesting = -1;
        if (ready && !held) {
          harvesting = i;
          return update('h-coins', ''); // bảng thu hoạch tự có tiêu đề, không lặp lại ở dòng trạng thái
        }
        if (held && !item) {
          const it = findItem(held.id);
          state.farm.slots[i] = { id: held.id, at: held.at };
          held = null;
          ctx.sound('good');
          return update(`slot-${i}`, `Đã đặt ${it.name} vào ô ${i + 1}.`);
        }
        if (held) { ctx.sound('bad'); return update(`slot-${i}`, 'Ô này đã có vật rồi, hãy chọn ô trống.'); }
        if (item) {
          held = { id: s.id, at: s.at, from: i };
          state.farm.slots[i] = null;
          return update(`slot-${i}`, `Đang cầm ${item.name}. Hãy bấm vào một ô trống để đặt.`);
        }
        ctx.sound('bad');
        update(`slot-${i}`, 'Hãy chọn một vật trong kho trước nhé.');
      },
    }, [item ? h('span', { class: 'farm-item ' + (egg && grown ? 'anim-wander' : ready ? 'anim-sway' : ''), 'aria-hidden': 'true' }, emoji) : null, countdown]);
    if (countdown) timers.push({ item, at: s.at, stage, span: countdown, btn, minutes: Math.ceil(msUntilGrown(item, s.at, Date.now()) / 60_000), i });
    return h('li', null, btn);
  }

  /** Mỗi giây: cập nhật đồng hồ; khi cây đổi hình hoặc chín thì vẽ lại, chín thì phát nhạc. */
  function tick() {
    if (!root.isConnected) { clearInterval(ticker); return; }
    const now = Date.now();
    let changed = false;
    const ripe = [];
    for (const t of timers) {
      const rem = msUntilGrown(t.item, t.at, now);
      if (rem <= 0) { ripe.push(t.item); changed = true; continue; }
      if (growthStage(t.item, t.at, now) !== t.stage) changed = true;
      t.span.textContent = formatCountdown(rem);
      t.span.classList.toggle('soon', rem <= 60_000);
      const minutes = Math.ceil(rem / 60_000);
      if (minutes !== t.minutes) { // chỉ cập nhật nhãn đọc to khi đổi phút, tránh trình đọc màn hình đọc liên tục
        t.minutes = minutes;
        t.btn.setAttribute('aria-label', `Ô ${t.i + 1}: ${t.item.name}, ${t.item.kind === 'egg' ? 'đang ấp' : 'đang lớn'}, ${minutesLabel(rem)}. Bấm để nhấc lên`);
      }
    }
    if (!changed) return;
    const key = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute('data-key') : null;
    if (ripe.length) {
      const plants = [...new Set(ripe.filter((t) => t.kind === 'plant').map((t) => t.name))];
      const hatched = ripe.some((t) => t.kind === 'egg');
      message = [plants.length ? `${plants.join(', ')} đã chín! Bé thu hoạch nhé 🎉` : '', hatched ? 'Trứng gà đã nở thành gà trống! 🐣' : ''].filter(Boolean).join(' ');
      ctx.sound('ripe');
    }
    render();
    const back = key && root.querySelector(`[data-key="${key}"]:not([disabled])`);
    if (back) back.focus({ preventScroll: true });
  }

  function wearToggle(it) {
    const worn = state.farm.outfit[it.slot] === it.id;
    return h('button', {
      class: 'btn', type: 'button', 'aria-pressed': String(worn), 'data-key': `wear-${it.id}`,
      onClick: () => {
        state.farm.outfit[it.slot] = worn ? null : it.id;
        ctx.sound('tap');
        update(`wear-${it.id}`, worn ? `Đã cởi ${it.name}.` : `Bé đã ${WEAR_LABEL[it.slot].toLowerCase()} ${it.name}.`);
      },
    }, worn ? 'Cởi' : WEAR_LABEL[it.slot]);
  }

  function shopRow(it) {
    const have = countOf(state.inventory, it.id);
    const wear = it.kind === 'wear';
    const maxed = have >= (wear ? 1 : MAX_STACK);
    const sub = wear ? (have ? 'Đã có' : `${it.cost} xu`) : `${it.cost} xu • đã có ${have}/${MAX_STACK}${it.kind === 'egg' ? ' • nở sau 2 giờ' : ''}`;
    const buy = h('button', {
      class: 'btn', type: 'button', disabled: maxed || state.coins < it.cost, 'data-key': `buy-${it.id}`,
      onClick: () => {
        const r = buyItem(state, it.id);
        if (!r.ok) { ctx.sound('bad'); return; }
        state.coins = r.profile.coins;
        state.inventory = r.profile.inventory;
        ctx.sound('good');
        update(`buy-${it.id}`, `Đã mua ${it.name}. ${wear ? 'Hãy mặc thử nhé!' : 'Vật mới đang ở trong kho, hãy đặt vào nông trại.'}`);
      },
    }, maxed ? '✓' : 'Mua');
    return h('li', { class: 'shop-item' }, [
      h('span', { class: 'farm-item', 'aria-hidden': 'true' }, it.emoji),
      h('div', { class: 'grow' }, [h('strong', null, it.name), h('div', { class: 'small' }, sub)]),
      wear && have ? wearToggle(it) : buy,
    ]);
  }

  function harvestPanel() {
    const s = state.farm.slots[harvesting];
    const item = s && findItem(s.id);
    if (!item) return null;
    const take = (choice, what) => {
      const r = harvest(state, harvesting, choice, Date.now());
      if (!r.ok) { ctx.sound('bad'); return update(null, 'Cây chưa chín nên chưa thu hoạch được.'); }
      const idx = harvesting;
      Object.assign(state, { coins: r.profile.coins, gifts: r.profile.gifts, inventory: r.profile.inventory });
      state.farm.slots = r.profile.farm.slots;
      harvesting = -1;
      ctx.sound('win');
      update(`slot-${idx}`, `Bé đã thu hoạch ${item.name} và nhận ${what}!`);
    };
    return h('div', { class: 'card harvest', role: 'group', 'aria-label': `Thu hoạch ${item.name}` }, [
      h('h2', null, `${item.stages[item.stages.length - 1]} ${item.name} đã chín!`),
      h('p', null, 'Bé muốn đổi lấy gì?'),
      h('div', { class: 'row' }, [
        h('button', { class: 'btn primary', type: 'button', 'data-key': 'h-coins', onClick: () => take('coins', `${harvestCoins(item)} xu`) }, `🪙 ${harvestCoins(item)} xu`),
        ...GIFTS.map((g) => h('button', { class: 'btn', type: 'button', 'data-key': `h-${g.id}`, onClick: () => take(g.id, g.name.toLowerCase()) }, `${g.emoji} ${g.name}`)),
      ]),
      h('div', { class: 'row' }, [
        h('button', {
          class: 'btn link', type: 'button', 'data-key': 'h-move',
          onClick: () => {
            const i = harvesting;
            held = { id: s.id, at: s.at, from: i };
            state.farm.slots[i] = null;
            harvesting = -1;
            update(null, `Đang cầm ${item.name}. Hãy bấm vào một ô trống để đặt.`);
          },
        }, 'Nhấc sang ô khác'),
        h('button', { class: 'btn link', type: 'button', 'data-key': 'h-cancel', onClick: () => { const i = harvesting; harvesting = -1; update(`slot-${i}`, ''); } }, 'Để lại'),
      ]),
    ]);
  }

  function render() {
    timers = [];
    const stock = FARM_ITEMS.filter((it) => it.kind !== 'wear' && available(it.id) > 0);
    const badges = BADGES.map((b) => {
      const got = state.badges.includes(b.id);
      return h('li', { class: 'badge' + (got ? ' got' : '') }, [
        h('span', { class: 'badge-emoji', 'aria-hidden': 'true' }, got ? b.emoji : '❔'),
        h('div', null, [h('strong', null, b.name), h('div', { class: 'small' }, got ? b.desc : `Cách đạt: ${b.desc}`)]),
      ]);
    });
    const heldItem = held && findItem(held.id);

    root.replaceChildren(...[
      h('button', { class: 'btn link', type: 'button', onClick: () => ctx.go('map') }, '← Về bản đồ'),
      h('h1', { 'data-autofocus': true }, 'Nông trại ước mơ'),
      h('p', null, `Bé đang có ${state.coins} xu`),
      h('div', { class: 'farm-hero' }, [avatarView(state, 'big'), h('p', { class: 'small' }, 'Mua nón lá, áo bà ba rồi mặc cho nhân vật. Cây lớn hẳn sau 2 giờ, hãy chờ nhạc báo nhé!')]),
      h('ul', { class: 'farm-grid', 'aria-label': `Nông trại, ${FARM_SLOTS} ô đất` }, Array.from({ length: FARM_SLOTS }, (_, i) => plotView(i))),
      harvesting >= 0 ? harvestPanel() : null,
      h('p', { class: 'help', role: 'status' }, message),
      heldItem
        ? h('div', { class: 'row' }, [
          h('span', null, `Đang cầm: ${heldItem.emoji} ${heldItem.name}`),
          h('button', {
            class: 'btn', type: 'button', 'data-key': 'cancel',
            onClick: () => {
              const back = held.from >= 0 && !state.farm.slots[held.from] ? held.from : -1;
              if (back >= 0) state.farm.slots[back] = { id: held.id, at: held.at };
              held = null;
              update(back >= 0 ? `slot-${back}` : 'cancel', 'Đã cất lại.');
            },
          }, 'Bỏ qua'),
        ])
        : null,
      h('h2', null, 'Kho đồ'),
      stock.length
        ? h('ul', { class: 'list' }, stock.map((it) => h('li', { class: 'shop-item' }, [
          h('span', { class: 'farm-item', 'aria-hidden': 'true' }, it.emoji),
          h('div', { class: 'grow' }, [h('strong', null, it.name), h('div', { class: 'small' }, `Còn ${available(it.id)} chưa đặt`)]),
          h('button', {
            class: 'btn', type: 'button', 'data-key': `place-${it.id}`,
            onClick: () => {
              if (held && held.from >= 0 && !state.farm.slots[held.from]) state.farm.slots[held.from] = { id: held.id, at: held.at };
              held = { id: it.id, at: Date.now(), from: -1 };
              update(null, `Đang cầm ${it.name}. Hãy bấm vào một ô trống để đặt.`);
              const first = root.querySelector('.plot.target');
              if (first) first.focus({ preventScroll: true });
            },
          }, 'Đặt'),
        ])))
        : h('p', { class: 'help' }, 'Kho trống. Mua vật phẩm ở cửa hàng, rồi đặt vào nông trại.'),
      h('h2', null, 'Kho quà của bé'),
      h('ul', { class: 'list gifts' }, GIFTS.map((g) => h('li', { class: 'gift-item' }, [
        h('span', { class: 'farm-item', 'aria-hidden': 'true' }, g.emoji),
        h('div', { class: 'grow' }, [h('strong', null, g.name), h('div', { class: 'small' }, state.gifts[g.id] ? `Bé có ${state.gifts[g.id]}` : 'Chưa có. Thu hoạch cây đã lớn và gà trống để nhận!')]),
      ]))),
      h('h2', null, 'Cửa hàng làng'),
      h('ul', { class: 'list' }, FARM_ITEMS.map(shopRow)),
      h('h2', null, 'Huy hiệu'),
      h('ul', { class: 'list' }, badges),
    ].filter(Boolean)); // replaceChildren biến null thành chữ "null"
  }

  render();
  const ticker = setInterval(tick, 1000);
  return root;
}
