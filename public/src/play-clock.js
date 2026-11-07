// Đồng hồ học: cộng dồn thời gian ĐANG tương tác, nhắc nghỉ mắt sau N phút (FR8).
// Nhận `now` từ bên ngoài để test được mà không cần timer thật.

export class PlayClock {
  /**
   * @param {{breakMinutes?:number, idleMs?:number}} opts
   */
  constructor({ breakMinutes = 20, idleMs = 60_000 } = {}) {
    this.breakMs = Math.min(40, Math.max(10, breakMinutes)) * 60_000;
    this.idleMs = idleMs;
    this.activeMs = 0; // tổng thời gian học trong phiên
    this.sinceBreakMs = 0;
    this.lastTick = null;
    this.lastInteract = null;
  }

  /** Gọi khi có tương tác (chạm/phím). */
  interact(now) {
    this.tick(now);
    this.lastInteract = now;
  }

  /** Gọi định kỳ (ví dụ mỗi giây). Trả về true nếu đã đến giờ nghỉ mắt. */
  tick(now) {
    if (this.lastTick !== null && this.lastInteract !== null) {
      const delta = Math.max(0, now - this.lastTick);
      // chỉ tính khi vẫn còn "đang tương tác" (không treo máy bỏ đó)
      if (now - this.lastInteract <= this.idleMs) {
        this.activeMs += delta;
        this.sinceBreakMs += delta;
      } else if (this.lastTick - this.lastInteract < this.idleMs) {
        // phần còn lại của cửa sổ idle trước khi dừng
        const extra = Math.max(0, this.lastInteract + this.idleMs - this.lastTick);
        this.activeMs += extra;
        this.sinceBreakMs += extra;
      }
    }
    this.lastTick = now;
    return this.breakDue;
  }

  get breakDue() {
    return this.sinceBreakMs >= this.breakMs;
  }

  /** Bé đã nghỉ xong. */
  acknowledgeBreak() {
    this.sinceBreakMs = 0;
  }

  /** Lấy số phút nguyên đã học rồi reset bộ đếm để lưu vào daily. */
  drainMinutes() {
    const whole = Math.floor(this.activeMs / 60_000);
    this.activeMs -= whole * 60_000;
    return whole;
  }
}

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
