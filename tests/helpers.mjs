// 測試用的假 localStorage；可設定容量上限來模擬「儲存空間不足」
export function installMockStorage(limitChars = Infinity) {
  const map = new Map();
  const store = {
    limit: limitChars,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem(k, v) {
      v = String(v);
      let used = 0;
      for (const [kk, vv] of map) if (kk !== k) used += vv.length;
      if (used + v.length > store.limit) {
        const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e;
      }
      map.set(k, v);
    },
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    get length() { return map.size; },
    _map: map,
  };
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
  return store;
}

// 假的 AudioContext：只記錄呼叫，用來測試播放邏輯與定時關閉
export function installMockAudio() {
  const param = () => ({ value: 1, events: [], cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v, t) { this.events.push(['ramp', v, t]); }, setTargetAtTime(v) { this.value = v; } });
  class Node { connect(n) { return n; } disconnect() {} }
  class Ctx {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 8000; this.destination = new Node(); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createGain() { const n = new Node(); n.gain = param(); return n; }
    createBuffer(ch, len, rate) { return { length: len, sampleRate: rate, copyToChannel() {} }; }
    createBufferSource() { const n = new Node(); n.started = false; n.stopped = false; n.start = () => { n.started = true; }; n.stop = () => { n.stopped = true; }; return n; }
  }
  globalThis.AudioContext = Ctx;
}
