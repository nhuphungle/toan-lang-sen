// E2E smoke test chạy app thật bằng Chromium (Playwright có sẵn trên máy, KHÔNG thêm dependency vào dự án).
// Chạy: PLAYWRIGHT_PATH=/đường/dẫn/node_modules/playwright npm run test:e2e   (SHOT_DIR=... để lưu ảnh)
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from '../server.mjs';

const pwPath = process.env.PLAYWRIGHT_PATH || path.join(os.homedir(), 'Playwright-learning/node_modules/playwright');
let chromium;
try { ({ chromium } = createRequire(import.meta.url)(pwPath)); } catch {
  console.error(`Không tìm thấy Playwright tại ${pwPath}. Đặt PLAYWRIGHT_PATH.`); process.exit(2);
}
const shots = process.env.SHOT_DIR;
if (shots) fs.mkdirSync(shots, { recursive: true });

const srv = createServer();
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 780 }, serviceWorkers: 'allow' });
const page = await context.newPage();

const problems = [];
const external = [];
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) problems.push('console: ' + m.text()); });
page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });

const results = [];
async function step(name, fn) {
  try { await fn(); results.push(['✔', name]); console.log('✔', name); }
  catch (e) { results.push(['✖', name]); console.error('✖', name, '\n   ', e.message.split('\n')[0]); problems.push(`${name}: ${e.message.split('\n')[0]}`); }
}
const shot = (n) => shots && page.screenshot({ path: path.join(shots, n + '.png'), fullPage: true });
const noHScroll = async (label) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${label}: tràn ngang`);

await step('Tải trang, hiện màn hình chào, không lỗi', async () => {
  await page.goto(origin + '/');
  await page.getByRole('heading', { name: 'Toán Làng Sen' }).waitFor();
  await noHScroll('welcome'); await shot('1-welcome');
});

await step('XSS: biệt danh chứa HTML bị làm sạch, không thực thi', async () => {
  await page.fill('#nick', '<img src=x onerror="window.__xss=1">Na');
  await page.getByRole('button', { name: /Bông/ }).click();
  await page.getByRole('button', { name: 'Bắt đầu hành trình' }).click();
  await page.getByRole('heading', { name: 'Bản đồ làng nghề' }).waitFor();
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator('img').count(), 0);
  const nick = await page.evaluate(() => JSON.parse(localStorage.getItem('tls.v1')).profile.nickname);
  assert.ok(!/[<>=]/.test(nick), nick);
  await noHScroll('map'); await shot('2-map');
});

await step('Bắt buộc nhập tên: bỏ trống bị chặn (kiểm tra ở lần tải mới)', async () => {
  const p2 = await context.newPage();
  await p2.addInitScript(() => localStorage.clear());
  await p2.goto(origin + '/');
  await p2.getByRole('button', { name: 'Bắt đầu hành trình' }).click();
  await p2.getByText('Bé nhập tên của mình nhé').waitFor();
  await p2.close();
});

await step('Chơi trọn 1 bài học 8 câu (mọi kiểu tương tác) tới màn kết quả', async () => {
  await page.getByRole('button', { name: 'Vào chơi' }).click();
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    await page.locator('.question').waitFor();
    const text = await page.locator('.question').innerText();
    assert.doesNotMatch(await page.locator('.stage').innerText(), /\bnull\b|undefined/, 'màn câu hỏi hiện chữ null/undefined');
    const nextBtn = page.getByRole('button', { name: /Câu tiếp theo|Xem kết quả/ });
    for (let attempt = 0; attempt < 3 && !(await nextBtn.count()); attempt++) {
      if (await page.locator('.choices').count()) {
        seen.add('choice');
        await page.locator('.choice:not([disabled])').first().click();
      } else if (await page.locator('.tray').count()) {
        seen.add('basket');
        const n = Number(text.match(/\d+/)[0]);
        await page.locator('button:has-text("Làm lại")').click();
        for (let k = 0; k < n; k++) await page.locator('.tray-item:not([disabled])').first().click();
        await page.getByRole('button', { name: 'Xong rồi' }).click();
      } else if (await page.locator('.sort-items').count()) {
        seen.add('classify');
        const items = page.locator('.sort-item');
        for (let k = 0; k < (await items.count()); k++) { await items.nth(k).click(); await page.locator('.bucket').first().click(); }
        await page.getByRole('button', { name: 'Xong rồi' }).click();
      }
    }
    if (i === 0) { await shot('3-lesson'); await noHScroll('lesson'); }
    await nextBtn.click();
  }
  await page.getByRole('heading', { name: 'Hoàn thành bài học!' }).waitFor();
  await shot('4-result');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('tls.v1')));
  assert.equal(st.stats.lessonsDone, 1); assert.equal(st.stats.totalAnswered, 8);
  assert.ok(st.xp >= 0 && st.badges.includes('buoc-dau'));
  console.log('   kiểu tương tác đã gặp:', [...seen].join(', '));
});

await step('Trả lời ĐÚNG được cộng XP và xu', async () => {
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('tls.v1')).xp);
  await page.getByRole('button', { name: 'Chơi tiếp' }).click();
  // Giải thật: đọc câu hỏi, tự tính đáp án cho câu cộng/trừ/đếm kiểu choice
  for (let i = 0; i < 8; i++) {
    await page.locator('.question').waitFor();
    const text = await page.locator('.question').innerText();
    const nextBtn = page.getByRole('button', { name: /Câu tiếp theo|Xem kết quả/ });
    const nums = (text.match(/\d+/g) || []).map(Number);
    if (await page.locator('.choices').count()) {
      const labels = await page.locator('.choice').allInnerTexts();
      let target = null;
      if (/thêm|tất cả|hái được|Hỏi mẹ có tất cả|gian hàng/i.test(text) && nums.length >= 2) target = nums[0] + nums[1];
      else if (/lấy đi|cho hàng xóm|biếu|bán đi|còn lại/i.test(text) && nums.length >= 2) target = nums[0] - nums[1];
      else if (/đếm/i.test(text) && (await page.locator('.visual').count())) target = await page.locator('.visual').first().evaluate((el) => el.children.length); // câu số liền sau/dãy số không có hình: chọn đại
      const idx = labels.findIndex((l) => l.trim() === String(target));
      await page.locator('.choice').nth(idx >= 0 ? idx : 0).click();
    } else if (await page.locator('.tray').count()) {
      for (let k = 0; k < nums[0]; k++) await page.locator('.tray-item:not([disabled])').first().click();
      await page.getByRole('button', { name: 'Xong rồi' }).click();
    } else {
      const items = page.locator('.sort-item'); const n = await items.count();
      const names = await items.allInnerTexts();
      const buckets = await page.locator('.bucket').allInnerTexts();
      for (let k = 0; k < n; k++) {
        const want = /chưng|khăn/.test(names[k]) ? 'vuông' : /nón/.test(names[k]) ? 'tam giác' : 'tròn';
        await items.nth(k).click();
        await page.locator('.bucket').nth(Math.max(0, buckets.findIndex((b) => b.toLowerCase().includes(want)))).click();
      }
      await page.getByRole('button', { name: 'Xong rồi' }).click();
    }
    if (!(await nextBtn.count())) await page.locator('.choice:not([disabled])').first().click({ timeout: 500 }).catch(() => {});
    await nextBtn.click();
  }
  await page.getByRole('heading', { name: 'Hoàn thành bài học!' }).waitFor();
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('tls.v1')));
  assert.ok(st.xp > before, `XP không tăng: ${before} -> ${st.xp}`);
  assert.equal(st.xp, st.coins, 'xu = XP khi chưa mua gì');
  console.log(`   XP ${before} -> ${st.xp}, đúng lần đầu cả phiên: ${st.stats.totalCorrect}/${st.stats.totalAnswered}`);
});

await step('Nông trại: xu không đủ thì khoá nút mua; mua được khi đủ xu', async () => {
  await page.getByRole('button', { name: 'Về bản đồ' }).click();
  await page.getByRole('button', { name: /Nông trại/ }).click();
  await page.getByRole('heading', { name: 'Nông trại ước mơ' }).waitFor();
  const coins = await page.evaluate(() => JSON.parse(localStorage.getItem('tls.v1')).coins);
  const first = page.locator('.shop-item').first().getByRole('button');
  if (coins >= 30) { await first.click(); await page.getByRole('heading', { name: 'Nông trại ước mơ' }).waitFor(); assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('tls.v1')).inventory.length), 1); }
  else assert.ok(await first.isDisabled());
  await noHScroll('farm'); await shot('5-farm');
});

await step('Parent Hub: tạo PIN, sai PIN, khoá tạm sau 5 lần, đúng PIN khi đang khoá vẫn bị chặn', async () => {
  await page.getByRole('button', { name: /Về bản đồ/ }).click();
  await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  await page.fill('#pin', '12'); await page.fill('#pin2', '12'); await page.getByRole('button', { name: 'Tạo PIN' }).click();
  await page.getByText('PIN gồm 4 đến 8 chữ số').waitFor();
  await page.fill('#pin', '1234'); await page.fill('#pin2', '9999'); await page.getByRole('button', { name: 'Tạo PIN' }).click();
  await page.getByText('chưa giống nhau').waitFor();
  await page.fill('#pin2', '1234'); await page.getByRole('button', { name: 'Tạo PIN' }).click();
  await page.getByRole('heading', { name: /Báo cáo của/ }).waitFor();
  const raw = await page.evaluate(() => localStorage.getItem('tls.v1'));
  assert.ok(!raw.includes('1234'), 'PIN không được lưu dạng rõ'); assert.ok(JSON.parse(raw).parent.pin.iterations >= 100000);
  await noHScroll('parent'); await shot('6-parent');
  await page.getByRole('button', { name: /Về bản đồ/ }).click();
  await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  for (let i = 0; i < 5; i++) { await page.fill('#pin', '0000'); await page.getByRole('button', { name: 'Mở khoá' }).click(); await page.waitForTimeout(150); }
  await page.getByText(/Sai PIN quá nhiều lần/).waitFor();
  await page.fill('#pin', '1234'); await page.getByRole('button', { name: 'Mở khoá' }).click();
  await page.getByText(/Đã khoá tạm/).waitFor();
  assert.equal(await page.getByRole('heading', { name: /Báo cáo của/ }).count(), 0);
});

await step('Dữ liệu localStorage bị phá hoại: app vẫn chạy với giá trị an toàn', async () => {
  const p3 = await context.newPage();
  await p3.addInitScript(() => localStorage.setItem('tls.v1', JSON.stringify({ v: 1, xp: 1e99, profile: { nickname: '<script>alert(1)</script>Bé', avatar: 'x' }, inventory: ['__proto__'], __proto__: { x: 1 } })));
  await p3.goto(origin + '/');
  await p3.getByRole('heading', { name: 'Bản đồ làng nghề' }).waitFor();
  assert.ok((await p3.locator('.who strong').innerText()).startsWith('scriptalert1scriptBé'.slice(0, 5)));
  await p3.close();
  const p4 = await context.newPage();
  await p4.addInitScript(() => localStorage.setItem('tls.v1', '{not json'));
  await p4.goto(origin + '/');
  await p4.getByRole('heading', { name: 'Toán Làng Sen' }).waitFor();
  await p4.close();
});

await step('Offline (PWA): sau khi cache, tải lại vẫn chạy khi mất mạng', async () => {
  await page.evaluate(() => localStorage.clear()); // bỏ dữ liệu hỏng cố ý của bước trước
  await page.goto(origin + '/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // để trang được SW kiểm soát
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'Toán Làng Sen' }).waitFor({ timeout: 5000 });
  await page.fill('#nick', 'Offline'); await page.getByRole('button', { name: 'Bắt đầu hành trình' }).click();
  await page.getByRole('button', { name: 'Vào chơi' }).click(); // dữ liệu bài tải từ cache
  await page.locator('.question').waitFor();
  await context.setOffline(false);
});

await step('Bàn phím: có thể điền tên và bắt đầu chỉ bằng phím Enter', async () => {
  const p5 = await context.newPage();
  p5.on('pageerror', (e) => console.error('   p5 pageerror:', e.message)); p5.on('console', (m) => console.error('   p5 console:', m.text()));
  await p5.addInitScript(() => localStorage.clear());
  await p5.goto(origin + '/');
  await p5.waitForFunction(() => document.activeElement && document.activeElement.id === 'nick'); // ô tên tự nhận focus
  await p5.keyboard.type('Sen'); await p5.keyboard.press('Enter');
  try { await p5.getByRole('heading', { name: 'Bản đồ làng nghề' }).waitFor({ timeout: 4000 }); }
  catch (e) { console.error('   DEBUG url=', p5.url(), 'body=', (await p5.evaluate(() => document.body.innerText)).slice(0, 300), 'h1=', await p5.locator('h1').allInnerTexts(), 'err=', await p5.locator('.error').allInnerTexts(), 'nick=', await p5.inputValue('#nick').catch(() => '?')); throw e; }
  await p5.close();
});

await step('Không có request ra ngoài origin và không vi phạm CSP', async () => {
  assert.deepEqual(external, []);
});

await browser.close();
await new Promise((r) => srv.close(r));
const failed = results.filter((r) => r[0] === '✖').length;
if (problems.length) console.error('\nVấn đề phát hiện:\n- ' + [...new Set(problems)].join('\n- '));
console.log(`\nE2E: ${results.length - failed}/${results.length} bước đạt`);
process.exit(failed || problems.length ? 1 : 0);
