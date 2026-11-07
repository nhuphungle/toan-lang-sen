// E2E nông trại: mua trùng, đặt/nhấc/chuyển ô, cây lớn theo ngày, mặc đồ, giữ dữ liệu sau khi tải lại.
// Chạy: PLAYWRIGHT_PATH=/đường/dẫn/node_modules/playwright npm run test:e2e:farm   (SHOT_DIR=... để lưu ảnh)
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
const srv = createServer(); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const DAY = 86400000;
await page.addInitScript(([d]) => { if (!localStorage.getItem('tls.v1')) localStorage.setItem('tls.v1', JSON.stringify({ v: 1, xp: 50, coins: 1000, profile: { nickname: 'Na', avatar: 'bong' }, inventory: ['ruong-lua'], farm: { slots: [{ id: 'ruong-lua', at: Date.now() - 2 * d }] } })); }, [DAY]);
await page.goto(url);
await page.getByRole('button', { name: /Nông trại/ }).click();
await page.getByRole('heading', { name: 'Nông trại ước mơ' }).waitFor();
const st = () => page.evaluate(() => JSON.parse(localStorage.getItem('tls.v1')));
// cây đặt 2 ngày trước đã lớn hẳn
assert.match(await page.getByRole('button', { name: /Ô 1:/ }).getAttribute('aria-label'), /Ruộng lúa, đã chín/);
// mua 2 gà (trùng), đặt cả hai
await page.locator('[data-key="buy-trung-ga"]').click(); await page.locator('[data-key="buy-trung-ga"]').click();
assert.equal((await st()).inventory.filter((x) => x === 'trung-ga').length, 2);
await page.locator('[data-key="place-trung-ga"]').click();
await page.getByRole('button', { name: /Ô 2: trống/ }).click();
await page.locator('[data-key="place-trung-ga"]').click();
await page.getByRole('button', { name: /Ô 3: trống/ }).click();
let s = await st(); assert.deepEqual(s.farm.slots.slice(0, 3).map((x) => x && x.id), ['ruong-lua', 'trung-ga', 'trung-ga']);
assert.equal(await page.locator('[data-key^="place-"]').count(), 0); // kho hết
// nhấc gà ở ô 2, đặt sang ô 5
await page.getByRole('button', { name: /Ô 2:/ }).click(); await page.getByRole('button', { name: /Ô 5: trống/ }).click();
s = await st(); assert.equal(s.farm.slots[1], null); assert.equal(s.farm.slots[4].id, 'trung-ga');
// nhấc rồi bỏ qua -> về chỗ cũ
await page.getByRole('button', { name: /Ô 5:/ }).click(); await page.getByRole('button', { name: 'Bỏ qua' }).click();
assert.equal((await st()).farm.slots[4].id, 'trung-ga');
// thu hoạch ruộng lúa đã chín: nhận quà gấu bông -> vào Kho quà, ô trống ra, cây rời kho
await page.getByRole('button', { name: /Ô 1:/ }).click();
await page.getByRole('button', { name: /Gấu bông/ }).click();
s = await st(); assert.equal(s.gifts['gau-bong'], 1); assert.equal(s.farm.slots[0], null); assert.ok(!s.inventory.includes('ruong-lua'));
assert.match(await page.locator('.gifts').innerText(), /Bé có 1/);
// mua lại lúa, đặt vào ô 1: chưa chín nên bấm vào là nhấc lên chứ không mở thu hoạch
await page.locator('[data-key="buy-ruong-lua"]').click(); await page.locator('[data-key="place-ruong-lua"]').click();
await page.getByRole('button', { name: /Ô 1: trống/ }).click();
await page.getByRole('button', { name: /Ô 1:/ }).click();
assert.equal(await page.locator('.harvest').count(), 0);
await page.getByRole('button', { name: 'Bỏ qua' }).click();
// ép cây chín rồi đổi lấy xu
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('tls.v1')); d.farm.slots[0].at = 0; localStorage.setItem('tls.v1', JSON.stringify(d)); });
await page.reload(); await page.getByRole('button', { name: /Nông trại/ }).click();
const before = (await st()).coins;
await page.getByRole('button', { name: /Ô 1:/ }).click(); await page.getByRole('button', { name: /🪙 30 xu/ }).click();
assert.equal((await st()).coins, before + 30);
// đồng hồ đếm ngược: hoa sen còn ~3 giây nữa chín -> thấy đồng hồ, rồi tự báo "đã chín" và ô sáng viền vàng
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('tls.v1')); d.inventory.push('hoa-sen');
  d.farm.slots[7] = { id: 'hoa-sen', at: Date.now() - 2 * 3_600_000 + 3000 };
  localStorage.setItem('tls.v1', JSON.stringify(d));
});
await page.reload(); await page.getByRole('button', { name: /Nông trại/ }).click();
const lotus = page.getByRole('button', { name: /Ô 8:/ });
await lotus.locator('.countdown').waitFor();
assert.match(await lotus.locator('.countdown').innerText(), /^0:0[1-3]$/);
assert.match(await page.getByRole('button', { name: /Ô 8:/ }).getAttribute('aria-label'), /đang lớn, còn khoảng 1 phút/);
await page.locator('.plot.ready').nth(0).waitFor();
await page.getByText(/Hoa sen đã chín!/).waitFor({ timeout: 8000 });
assert.match(await page.getByRole('button', { name: /Ô 8:/ }).getAttribute('aria-label'), /đã chín/);
assert.equal(await lotus.locator('.countdown').count(), 0);
// trứng gà nở: còn ~3 giây -> đếm ngược, rồi tự báo "nở thành gà trống"; gà đã nở không có bảng thu hoạch
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('tls.v1')); d.inventory.push('trung-ga');
  d.farm.slots[9] = { id: 'trung-ga', at: Date.now() - 2 * 3_600_000 + 3000 };
  localStorage.setItem('tls.v1', JSON.stringify(d));
});
await page.reload(); await page.getByRole('button', { name: /Nông trại/ }).click();
assert.match(await page.getByRole('button', { name: /Ô 10:/ }).getAttribute('aria-label'), /Trứng gà, đang ấp/);
await page.getByText(/nở thành gà trống/).waitFor({ timeout: 8000 });
assert.match(await page.getByRole('button', { name: /Ô 10:/ }).getAttribute('aria-label'), /Gà trống\. Bấm để nhấc lên/);
await page.getByRole('button', { name: /Ô 10:/ }).click();
assert.equal(await page.locator('.harvest').count(), 0);
await page.getByRole('button', { name: 'Bỏ qua' }).click();
// mặc nón + áo
await page.locator('[data-key="buy-non-la"]').click(); await page.locator('[data-key="wear-non-la"]').click();
await page.locator('[data-key="buy-ao-ba-ba"]').click(); await page.locator('[data-key="wear-ao-ba-ba"]').click();
assert.deepEqual((await st()).farm.outfit, { hat: 'non-la', top: 'ao-ba-ba' });
assert.equal(await page.locator('.farm-hero .wear-hat').count(), 1);
if (process.env.SHOT_DIR) { fs.mkdirSync(process.env.SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.SHOT_DIR, 'farm.png'), fullPage: true }); }
// tải lại: giữ nguyên; map hiển thị đồ mặc
await page.reload(); await page.getByRole('button', { name: /Nông trại/ }).click();
assert.equal((await st()).farm.slots[4].id, 'trung-ga');
await page.getByRole('button', { name: 'Về bản đồ' }).click();
assert.equal(await page.locator('.topbar .wear-hat').count(), 1);
const hs = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth); assert.ok(hs);
assert.deepEqual(errs, []);
console.log('FARM E2E OK'); await b.close(); srv.close();
