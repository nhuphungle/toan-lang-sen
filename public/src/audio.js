// Âm báo tổng hợp bằng WebAudio (không tải tệp ngoài). AudioContext chỉ tạo sau lần chạm đầu tiên
// (yêu cầu autoplay của trình duyệt, đặc biệt Safari iOS).
let ctx = null;

function ensure() {
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, start, dur, type = 'sine', gain = 0.12) {
  const c = ensure();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sounds = {
  tap: () => tone(520, 0, 0.06, 'triangle', 0.06),
  good: () => { tone(660, 0, 0.12); tone(880, 0.12, 0.18); },
  bad: () => tone(220, 0, 0.22, 'triangle', 0.1),
  // giai điệu ngắn vui tai báo cây đã chín
  ripe: () => [784, 988, 1175, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.15, i === 5 ? 0.5 : 0.18, 'sine', 0.1)),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.2)),
};

export function play(name, enabled) {
  if (enabled && sounds[name]) sounds[name]();
}
