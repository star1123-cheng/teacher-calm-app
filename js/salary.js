// 薪水計算（純函式）：查表、晉級模擬、依秒數分攤
// 時間一律用本地時間；每個月的薪水平均分攤到該月實際總秒數（24 小時均分）

export function levelInfo(table, level) {
  return table.levels.find((l) => l.level === level);
}

function inRange(seg, p) {
  return (seg.minPoints == null || p >= seg.minPoints) && (seg.maxPoints == null || p <= seg.maxPoints);
}
export function researchAmount(table, points) {
  return table.researchAllowance.find((s) => inRange(s, points))?.amount ?? 0;
}
export function leaderAmount(table, points) {
  return table.leaderAllowance.find((s) => inRange(s, points))?.amount ?? 0;
}

// 該學歷年功薪上限對應的薪級（級號越小薪點越高）
export function capLevel(table, edu) {
  const max = table.education[edu].maxSeniorityPoints;
  return table.levels.filter((l) => l.points <= max).reduce((a, l) => Math.min(a, l.level), 36);
}

const promoOn = (year, mmdd) => {
  const [m, d] = mmdd.split('-').map(Number);
  return new Date(year, m - 1, d);
};

// 時間點 t 的薪級：today 之後每經過一次晉級日升一級，到學歷上限為止；過去的時間一律用目前薪級（假設，不回推）
export function levelAt(table, h, t, today) {
  if (t <= today) return h.level;
  let count = 0;
  for (let y = today.getFullYear(); y <= t.getFullYear(); y++) {
    const p = promoOn(y, h.promoteDate || '08-01');
    if (p > today && p <= t) count++;
  }
  const cap = capLevel(table, h.edu);
  return Math.min(h.level, Math.max(cap, h.level - count));
}

// 月應領各項明細；raiseYears 為調薪經過年數
export function monthlyPay(table, h, level, raiseYears = 0) {
  const info = levelInfo(table, level);
  const o = h.overrides || {};
  const base = info.monthly;
  const research = h.toggles.research ? (o.research ?? researchAmount(table, info.points)) : 0;
  const homeroom = h.toggles.homeroom ? (o.homeroom ?? table.homeroomAllowance.amount) : 0;
  const leader = h.toggles.leader ? (o.leader ?? leaderAmount(table, info.points)) : 0;
  const factor = (1 + (h.annualRaise || 0) / 100) ** Math.max(0, raiseYears);
  return { level, points: info.points, base, research, homeroom, leader, total: (base + research + homeroom + leader) * factor };
}

const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const nextMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1);

// 調薪經過年數：以日曆年計（假設每年 1/1 調薪）；過去一律 0
export function raiseYearsAt(t, today) {
  return Math.max(0, t.getFullYear() - today.getFullYear());
}

// 時間點 t 所在月份的應領（含當時薪級與調薪）
export function payAt(table, h, t, today) {
  return monthlyPay(table, h, levelAt(table, h, t, today), raiseYearsAt(t, today));
}

// 時間點 t 的每秒金額
export function perSecondAt(table, h, t, today) {
  const ms = monthStart(t);
  return payAt(table, h, t, today).total / ((nextMonth(ms) - ms) / 1000);
}

// [from, to) 期間的應領總額：逐月加總，月中遇到晉級日則切開分段計算
export function earningsBetween(table, h, from, to, today) {
  if (!(to > from)) return 0;
  let sum = 0;
  let cur = new Date(from);
  while (cur < to) {
    const ms = monthStart(cur);
    const me = nextMonth(ms);
    const monthSec = (me - ms) / 1000;
    let end = me < to ? me : to;
    const promo = promoOn(cur.getFullYear(), h.promoteDate || '08-01');
    if (promo > cur && promo < end) end = promo;
    sum += payAt(table, h, cur, today).total * ((end - cur) / 1000) / monthSec;
    cur = end;
  }
  return sum;
}

// 退休日當天也算在職，所以領到退休日隔天 00:00 為止（假設）
export function retireEnd(retireDate) {
  const [y, m, d] = retireDate.split('-').map(Number);
  return new Date(y, m - 1, d + 1);
}

export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 一次算出畫面需要的數字
export function salarySummary(table, h, now = new Date()) {
  const end = retireEnd(h.retireDate);
  const retired = now >= end;
  const tallyFrom = parseDate(h.tallyStart || `${now.getFullYear()}-01-01`);
  const until = retired ? end : now;
  return {
    retired,
    current: payAt(table, h, now, now),
    perSecond: retired ? 0 : perSecondAt(table, h, now, now),
    earned: earningsBetween(table, h, tallyFrom, until, now),
    toRetire: retired ? 0 : earningsBetween(table, h, now, end, now),
  };
}
