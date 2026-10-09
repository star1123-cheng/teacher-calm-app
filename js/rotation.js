// 隨機、一輪不重複的輪替（一日一句與毒雞湯共用）
// state = { order:[id...], pos, round, today:{date,id} }
// groups：依優先順序排列的 id 陣列，例如 [作家句, 原創句]；同一輪內前面的群組一定先出完

export function emptyState() { return { order: [], pos: 0, round: 0, today: null }; }

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newOrder(groups, rng) {
  return groups.flatMap((g) => shuffle(g, rng));
}

// 讓輪替順序跟上句庫變動：刪掉已不存在的 id；新加入的 id 依群組插入尚未出現的區段
function reconcile(state, groups, rng) {
  const all = new Set(groups.flat());
  const shown = state.order.slice(0, state.pos).filter((id) => all.has(id));
  const rest = state.order.slice(state.pos).filter((id) => all.has(id));
  const known = new Set([...shown, ...rest]);
  // 剩餘部分依群組重新排列：保留原本的相對順序，新 id 隨機排在該群組最前面
  const remaining = groups.flatMap((g) => {
    const inGroup = new Set(g);
    return [...shuffle(g.filter((id) => !known.has(id)), rng), ...rest.filter((id) => inGroup.has(id))];
  });
  return { ...state, order: [...shown, ...remaining], pos: shown.length };
}

// 抽下一句（不看日期），回傳新的 state
export function advance(state, groups, today, rng = Math.random) {
  let s = reconcile({ ...emptyState(), ...state }, groups, rng);
  if (s.order.length === 0) return { ...s, today: null };
  if (s.pos >= s.order.length) {
    s = { ...s, order: newOrder(groups, rng), pos: 0, round: s.round + 1 };
    // 新一輪的第一句避免和上一句相同
    if (s.order.length > 1 && state.today && s.order[0] === state.today.id) {
      const i = s.order.findIndex((id, k) => k > 0 && groups.findIndex((g) => g.includes(id)) === groups.findIndex((g) => g.includes(s.order[0])));
      if (i > 0) [s.order[0], s.order[i]] = [s.order[i], s.order[0]];
    }
  }
  const id = s.order[s.pos];
  return { ...s, pos: s.pos + 1, today: { date: today, id } };
}

// 今天的那一句：同一天回傳同一句，隔天才換
export function pickToday(state, groups, today, rng = Math.random) {
  const all = new Set(groups.flat());
  if (state && state.today && state.today.date === today && all.has(state.today.id)) return state;
  return advance(state || emptyState(), groups, today, rng);
}
