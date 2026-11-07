// Luật thích ứng độ khó (FR7). Hàm thuần, không đột biến state đầu vào.

export const MAX_LEVEL = 3;
export const UP_STREAK = 5;
export const DOWN_WRONG = 2;

export const defaultSkill = () => ({ level: 1, streak: 0, wrongStreak: 0 });

/**
 * @param {{level:number,streak:number,wrongStreak:number}} s
 * @param {boolean} correct
 * @returns {{state:object, event:'none'|'level-up'|'level-down'|'challenge', visualHints:boolean}}
 */
export function updateSkill(s, correct) {
  if (correct) {
    const streak = s.streak + 1;
    if (streak >= UP_STREAK) {
      if (s.level < MAX_LEVEL) {
        return { state: { level: s.level + 1, streak: 0, wrongStreak: 0 }, event: 'level-up', visualHints: false };
      }
      // đã ở mức cao nhất: mở thử thách mở rộng
      return { state: { level: s.level, streak: 0, wrongStreak: 0 }, event: 'challenge', visualHints: false };
    }
    return { state: { level: s.level, streak, wrongStreak: 0 }, event: 'none', visualHints: false };
  }
  const wrongStreak = s.wrongStreak + 1;
  if (wrongStreak >= DOWN_WRONG && s.level > 1) {
    return { state: { level: s.level - 1, streak: 0, wrongStreak: 0 }, event: 'level-down', visualHints: true };
  }
  return { state: { level: s.level, streak: 0, wrongStreak }, event: 'none', visualHints: true };
}

/** Mức gợi ý (0..2) theo số lần sai trên chính câu này hoặc số lần xin gợi ý. */
export function hintLevel(wrongOnQuestion, hintsRequested = 0) {
  return Math.min(2, Math.max(wrongOnQuestion - 1, hintsRequested - 1));
}
