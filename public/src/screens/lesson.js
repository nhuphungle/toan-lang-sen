import { h } from '../dom.js';
import { generateSession, checkAnswer } from '../generator.js';
import { mulberry32 } from '../rng.js';
import { updateSkill, hintLevel } from '../adaptive.js';
import { xpForAnswer, recordAnswer, newBadges, BADGES, AVATAR_INFO } from '../rewards.js';

const QUESTIONS_PER_LESSON = 8;
const MAX_ATTEMPTS = 2;

function randomSeed() {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}

/** Lưới emoji minh hoạ (chỉ trang trí; câu hỏi vẫn đầy đủ bằng chữ). */
function visual(q) {
  if (q.count) {
    return h('div', { class: 'visual', role: 'img', 'aria-label': `${q.count} ${q.emoji}` }, Array.from({ length: q.count }, () => h('span', { 'aria-hidden': 'true' }, q.emoji)));
  }
  if (q.groups) {
    const [a, b] = q.groups;
    const rep = (n) => Array.from({ length: Math.abs(n) }, () => h('span', { 'aria-hidden': 'true' }, q.emoji));
    return h('div', { class: 'visual groups', role: 'img', 'aria-label': `${a} ${b > 0 ? 'thêm' : 'bớt'} ${Math.abs(b)}` }, [
      h('div', { class: 'group' }, rep(a)),
      h('span', { class: 'op', 'aria-hidden': 'true' }, b > 0 ? '+' : '−'),
      h('div', { class: 'group' + (b < 0 ? ' remove' : '') }, rep(b)),
    ]);
  }
  if (q.emoji) return h('div', { class: 'visual single', role: 'img', 'aria-label': q.text }, h('span', { 'aria-hidden': 'true' }, q.emoji));
  return null;
}

export function lessonScreen(ctx) {
  const { state } = ctx;
  const skillLevels = Object.fromEntries(Object.entries(state.skills).map(([k, v]) => [k, v.level]));
  const questions = generateSession(ctx.templates, { grade: 1, count: QUESTIONS_PER_LESSON, rng: mulberry32(randomSeed()), skillLevels });
  const av = AVATAR_INFO[state.profile.avatar];

  const stage = h('div', { class: 'stage' });
  const wrap = h('main', { class: 'screen lesson' }, [
    h('div', { class: 'lesson-top' }, [
      h('button', { class: 'btn link', type: 'button', onClick: () => ctx.go('map') }, '← Thoát'),
      h('span', { id: 'progress', class: 'small' }),
    ]),
    stage,
  ]);

  const session = { index: 0, xp: 0, correct: 0, events: [] };

  function showQuestion() {
    const q = questions[session.index];
    wrap.querySelector('#progress').textContent = `Câu ${session.index + 1}/${questions.length}`;
    const startedAt = Date.now();
    let attempts = 0;
    let hintsUsed = 0;
    let firstTry = null;
    let done = false;

    const feedback = h('div', { class: 'feedback', role: 'status', 'aria-live': 'polite' });
    const hintBox = h('div', { class: 'hint', role: 'note' });
    const actions = h('div', { class: 'row' });
    stage.replaceChildren();

    const showHint = () => {
      const lvl = Math.min(2, hintsUsed);
      hintsUsed += 1;
      hintBox.textContent = `💡 ${q.hints[lvl]}`;
      ctx.sound('tap');
    };

    const finish = (solved) => {
      if (done) return;
      done = true;
      const correct = firstTry === true;
      // Thống kê & thích ứng dựa trên lần thử ĐẦU (đo độ thành thạo thật);
      // XP thưởng cho cả bé kiên trì sửa lại đúng.
      const elapsed = Date.now() - startedAt;
      const gained = xpForAnswer({ correct: solved, difficulty: q.difficulty, hintsUsed: hintsUsed + (attempts - 1) });
      state.stats = recordAnswer(state.stats, { correct, skill: q.skill, topic: q.topic, elapsedMs: elapsed, hintsUsed: hintsUsed + (attempts - 1) });
      const upd = updateSkill(state.skills[q.skill], correct);
      state.skills[q.skill] = upd.state;
      if (upd.event === 'level-up') session.events.push('Bé đã lên mức khó mới! 🎉');
      if (upd.event === 'challenge') session.events.push('Bé mở khóa thử thách mở rộng! 🏆');
      state.xp += gained;
      state.coins += gained;
      session.xp += gained;
      if (correct) session.correct += 1;
      const badges = newBadges(state.stats, state.badges);
      state.badges.push(...badges);
      badges.forEach((id) => session.events.push(`Huy hiệu mới: ${BADGES.find((b) => b.id === id).name}!`));
      ctx.save();
      feedback.textContent = solved ? `Giỏi quá! +${gained} XP` : 'Không sao đâu, mình cùng xem đáp án nhé.';
      feedback.className = 'feedback ' + (solved ? 'ok' : 'info');
      if (!solved) revealAnswer();
      actions.replaceChildren(
        h('button', { class: 'btn primary big', type: 'button', 'data-autofocus': true, onClick: next }, session.index + 1 === questions.length ? 'Xem kết quả' : 'Câu tiếp theo'),
      );
      actions.querySelector('button').focus();
    };

    const submit = (response) => {
      if (done) return;
      attempts += 1;
      const ok = checkAnswer(q, response);
      if (firstTry === null) firstTry = ok;
      if (ok) { ctx.sound('good'); finish(true); return; }
      ctx.sound('bad');
      if (attempts >= MAX_ATTEMPTS) { finish(false); return; }
      feedback.textContent = 'Chưa đúng rồi, bé thử lại nhé!';
      feedback.className = 'feedback bad';
      hintBox.textContent = `💡 ${q.hints[hintLevel(attempts, hintsUsed)]}`;
      hintsUsed = Math.max(hintsUsed, 1);
    };

    let revealAnswer = () => {};
    let interaction;

    if (q.type === 'choice') {
      const buttons = q.choices.map((c) =>
        h('button', { class: 'choice', type: 'button', onClick: (e) => {
          if (done) return;
          submit(c.id);
          e.currentTarget.classList.add(checkAnswer(q, c.id) ? 'right' : 'wrong');
          if (!checkAnswer(q, c.id) && !done) e.currentTarget.disabled = true;
        } }, c.label),
      );
      revealAnswer = () => buttons.forEach((b, i) => { b.disabled = true; if (checkAnswer(q, q.choices[i].id)) b.classList.add('right'); });
      interaction = h('div', { class: 'choices' }, buttons);
    } else if (q.type === 'basket') {
      let placed = 0;
      const countEl = h('strong', { id: 'basket-count' }, '0');
      const tray = h('div', { class: 'tray', role: 'group', 'aria-label': 'Khay vật phẩm' });
      const items = Array.from({ length: q.basketMax }, (_, i) =>
        h('button', { class: 'tray-item', type: 'button', 'aria-label': `Bỏ vào giỏ (vật thứ ${i + 1})`, onClick: (e) => {
          if (done || e.currentTarget.disabled) return;
          e.currentTarget.disabled = true; placed += 1; countEl.textContent = String(placed); ctx.sound('tap');
        } }, q.emoji),
      );
      tray.append(...items);
      const reset = h('button', { class: 'btn', type: 'button', onClick: () => { if (done) return; placed = 0; countEl.textContent = '0'; items.forEach((b) => (b.disabled = false)); } }, 'Làm lại');
      const check = h('button', { class: 'btn primary', type: 'button', onClick: () => submit(placed) }, 'Xong rồi');
      revealAnswer = () => { items.forEach((b) => (b.disabled = true)); countEl.textContent = String(q.answer); };
      interaction = h('div', null, [h('div', { class: 'basket' }, ['🧺 Trong giỏ: ', countEl]), tray, h('div', { class: 'row' }, [reset, check])]);
    } else {
      // classify: chạm món đồ rồi chạm giỏ
      const assigned = new Array(q.items.length).fill(null);
      let selected = null;
      const labelOf = (shape) => q.buckets.find((b) => b.id === shape)?.label ?? '';
      const itemBtns = q.items.map((it, i) =>
        h('button', { class: 'sort-item', type: 'button', 'aria-pressed': 'false', onClick: () => {
          if (done) return;
          selected = i; itemBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i))); ctx.sound('tap');
        } }, [h('span', { 'aria-hidden': 'true' }, it.emoji), h('span', null, it.name), h('span', { class: 'assigned small' }, '')]),
      );
      const refresh = () => {
        itemBtns.forEach((b, i) => { b.querySelector('.assigned').textContent = assigned[i] ? `→ ${labelOf(assigned[i])}` : ''; });
        check.disabled = assigned.some((x) => x === null);
      };
      const bucketBtns = q.buckets.map((b) =>
        h('button', { class: 'bucket', type: 'button', onClick: () => {
          if (done || selected === null) return;
          assigned[selected] = b.id; selected = null; itemBtns.forEach((x) => x.setAttribute('aria-pressed', 'false')); ctx.sound('tap'); refresh();
        } }, `🧺 ${b.label}`),
      );
      const check = h('button', { class: 'btn primary', type: 'button', disabled: true, onClick: () => submit(assigned.slice()) }, 'Xong rồi');
      revealAnswer = () => { q.answer.forEach((s, i) => (assigned[i] = s)); refresh(); itemBtns.forEach((b) => (b.disabled = true)); bucketBtns.forEach((b) => (b.disabled = true)); check.disabled = true; };
      interaction = h('div', null, [
        h('p', { class: 'small' }, 'Chạm một món đồ, rồi chạm giỏ đúng hình dạng.'),
        h('div', { class: 'sort-board' }, [h('div', { class: 'sort-items' }, itemBtns), h('div', { class: 'buckets' }, bucketBtns)]), h('div', { class: 'row' }, [check]),
      ]);
    }

    // visual(q) có thể trả null (câu phân loại); append(null) sẽ chèn chữ "null" nên phải lọc.
    stage.append(...[
      h('div', { class: 'coach' }, [h('span', { class: 'avatar-emoji', 'aria-hidden': 'true' }, av.emoji), h('p', { class: 'question', 'data-autofocus': true }, q.text)]),
      visual(q),
      interaction,
      feedback,
      hintBox,
      h('div', { class: 'row' }, [h('button', { class: 'btn link', type: 'button', onClick: () => { if (!done) showHint(); } }, '💡 Gợi ý'), actions]),
    ].filter(Boolean));
    stage.querySelector('.question').setAttribute('tabindex', '-1');
    stage.querySelector('.question').focus({ preventScroll: true });
  }

  function next() {
    session.index += 1;
    if (session.index >= questions.length) return showResult();
    showQuestion();
  }

  function showResult() {
    state.stats.lessonsDone += 1;
    const b = newBadges(state.stats, state.badges);
    state.badges.push(...b);
    b.forEach((id) => session.events.push(`Huy hiệu mới: ${BADGES.find((x) => x.id === id).name}!`));
    ctx.save();
    ctx.sound('win');
    wrap.querySelector('#progress').textContent = '';
    stage.replaceChildren(
      h('div', { class: 'result' }, [
        h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, '🌟'),
        h('h1', { 'data-autofocus': true }, 'Hoàn thành bài học!'),
        h('p', null, `Bé trả lời đúng ngay từ đầu ${session.correct}/${questions.length} câu.`),
        h('p', null, `Nhận được ${session.xp} XP và ${session.xp} xu.`),
        session.events.length ? h('ul', { class: 'events' }, session.events.map((e) => h('li', null, e))) : null,
        h('div', { class: 'row' }, [
          h('button', { class: 'btn primary', type: 'button', onClick: () => ctx.go('lesson') }, 'Chơi tiếp'),
          h('button', { class: 'btn', type: 'button', onClick: () => ctx.go('map') }, 'Về bản đồ'),
        ]),
      ]),
    );
    stage.querySelector('h1').focus();
  }

  if (!questions.length) {
    stage.append(h('p', null, 'Chưa có bài học phù hợp.'), h('button', { class: 'btn', type: 'button', onClick: () => ctx.go('map') }, 'Về bản đồ'));
  } else {
    showQuestion();
  }
  return wrap;
}
