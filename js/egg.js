// 彩蛋計數：第一下起算 3 秒內點滿 5 下才觸發；超過 3 秒就從這一下重新計算
export const TAPS = 5;
export const WINDOW_MS = 3000;
export const HINT_FROM = 3;

export function createTapCounter({ taps = TAPS, windowMs = WINDOW_MS, hintFrom = HINT_FROM } = {}) {
  let first = 0;
  let count = 0;
  return {
    tap(now = Date.now()) {
      if (count === 0 || now - first > windowMs) { first = now; count = 0; }
      count++;
      const triggered = count >= taps;
      const result = { count, triggered, hint: !triggered && count >= hintFrom };
      if (triggered) count = 0;
      return result;
    },
    reset() { count = 0; },
    get count() { return count; },
  };
}
