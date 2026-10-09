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
