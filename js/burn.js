// 地獄轉場「燒幕」：星空布幕上一個字一個字浮現兩行字，
// 接著畫面由下往上燃燒（不規則火線＋餘燼），揭開底下的地獄模式。
// 全部用 canvas 即時畫出來（不需要圖片）；點一下或按任意鍵：寫字中直接開始燒，燒的時候加速。
// 視覺依 Claude Design「地獄轉場動畫」設計稿。

export const LINES = ['我常在開心的時候感到難過', '因為我不知道可以開心多久'];
const FONT = '"ThePeakFont", "TcalmBrush", "Xingkai TC", "STXingkai", "Kaiti TC", "BiauKai", "DFKai-SB", serif';
// 燃燒邊緣兩段寬度：E1 以內是亮黃火線，E1～E2 是焦黑邊
const E1 = 0.014;
const E2 = 0.065;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 平滑的隨機起伏（數值雜訊疊 4 層），回傳 0～1；用來讓火線不規則
const hash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const vnoise = (x, y, s) => {
  const xi = Math.floor(x); const yi = Math.floor(y); const xf = x - xi; const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s); const b = hash(xi + 1, yi, s); const c = hash(xi, yi + 1, s); const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, y, s) => {
  let t = 0; let a = 0.5; let f = 1;
  for (let o = 0; o < 4; o++) { t += a * vnoise(x * f, y * f, s + o); f *= 2.1; a *= 0.5; }
  return t / 0.9375;
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

const tint = () => { const q = Math.random(); return q < 0.15 ? '255,226,190' : q < 0.35 ? '190,210,255' : '235,238,255'; };

// 星空：深藍漸層、斜斜的銀河光帶、大小星點
function makeSky(w, h, dpr) {
  const c = makeCanvas(w * dpr, h * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#04060f');
  sky.addColorStop(0.55, '#0a1026');
  sky.addColorStop(1, '#141a3a');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const M = Math.max(w, h);
  g.save();
  g.translate(w * 0.5, h * 0.45);
  g.rotate(-0.55);
  g.scale(1, 0.22);
  const mw = g.createRadialGradient(0, 0, 0, 0, 0, M * 0.75);
  mw.addColorStop(0, 'rgba(150,160,220,.16)');
  mw.addColorStop(0.5, 'rgba(110,100,180,.07)');
  mw.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mw;
  g.fillRect(-M, -M * 4, M * 2, M * 8);
  g.restore();
  const star = (x, y, r, a, col) => { g.fillStyle = `rgba(${col},${a})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  for (let k = 0; k < Math.round((w * h) / 900); k++) { const r = Math.random(); star(Math.random() * w, Math.random() * h, 0.3 + r * 0.5, 0.12 + r * 0.35, tint()); }
  // 銀河帶上比較密的小星
  for (let k = 0; k < Math.round((w * h) / 2600); k++) {
    const u = Math.random() * 2 - 1; const t = (Math.random() - 0.5) * M * 0.9; const off = u * u * u * M * 0.12;
    star(w * 0.5 + t * Math.cos(-0.55) - off * Math.sin(-0.55), h * 0.45 + t * Math.sin(-0.55) + off * Math.cos(-0.55), 0.3 + Math.random() * 0.4, 0.2 + Math.random() * 0.3, '220,226,255');
  }
  return c;
}

// 回傳 Promise：動畫全部結束、畫布移除後 resolve
// onCovered：布幕完全蓋住畫面時呼叫（此時切換底下的模式，使用者看不到）
export async function playBurn({ onCovered, burnSeconds = 2.8 } = {}) {
  // 字型最多等 2.5 秒，避免第一次播放時字跳出預設字體
  try { await Promise.race([document.fonts?.load(`48px ${FONT}`, LINES.join('')), wait(2500)]); } catch { /* 用備用字體 */ }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (w * h * dpr * dpr > 4e6) dpr = Math.sqrt(4e6 / (w * h)); // 大螢幕降低解析度，避免卡頓

  const cv = makeCanvas(w * dpr, h * dpr);
  cv.className = 'burn';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', LINES.join('，'));
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  document.body.append(cv);
  document.getElementById('toast')?.classList.remove('show');

  // 燃燒進度圖：每 3 px 一格，下方數值大、上方小，再加雜訊；火線經過時依序燒掉
  const C = 3; const gw = Math.ceil(w / C); const gh = Math.ceil(h / C); const seed = (Math.random() * 1e6) | 0;
  const base = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) base[y * gw + x] = (1 - (y + 0.5) / gh) * 0.8 + fbm((x * C) / 26, (y * C) / 72, seed) * 0.2;
  const mask = makeCanvas(gw, gh); const glow = makeCanvas(gw, gh); const char = makeCanvas(gw, gh);
  const bloom = makeCanvas(Math.ceil(gw / 4), Math.ceil(gh / 4));
  const mD = new ImageData(gw, gh); const gD = new ImageData(gw, gh); const cD = new ImageData(gw, gh);
  for (let j = 0; j < mD.data.length; j += 4) mD.data[j] = mD.data[j + 1] = mD.data[j + 2] = 255;

  const sky = makeSky(w, h, dpr);
  const twinkles = Array.from({ length: Math.round((w * h) / 9000) }, () => ({ x: Math.random() * w, y: Math.random() * h * 0.92, r: 0.8 + Math.random() * 1.1, ph: Math.random() * Math.PI * 2, sp: 0.6 + Math.random() * 1.6, c: tint() }));

  // 文字排版：兩橫行置中，靠左對齊，逐字浮現
  const curtain = makeCanvas(w * dpr, h * dpr);
  const cc = curtain.getContext('2d');
  cc.setTransform(dpr, 0, 0, dpr, 0, 0);
  const fs = w < 600 ? Math.round(w * 0.064) : 60;
  const track = fs * 0.12;
  cc.font = `${fs}px ${FONT}`;
  cc.textBaseline = 'middle';
  const lay = (s) => { const ws = [...s].map((ch) => cc.measureText(ch).width); return { ws, w: ws.reduce((a, b) => a + b, 0) + track * (ws.length - 1) }; };
  const m1 = lay(LINES[0]); const m2 = lay(LINES[1]);
  const left = (w - Math.max(m1.w, m2.w)) / 2;
  const step = reduced ? 0 : 120;
  const chars = [];
  let tt = 800;
  [[LINES[0], m1, h / 2 - fs * 0.95], [LINES[1], m2, h / 2 + fs * 0.95]].forEach(([s, m, y], li) => {
    let x = left;
    if (li === 1) tt += 300;
    [...s].forEach((ch, i) => { chars.push({ ch, x, y, t0: tt }); x += m.ws[i] + track; tt += step; });
  });
  const fade = 500;
  let burnStart = tt + 420 + (reduced ? 1300 : 800);
  const burnDur = reduced ? 500 : burnSeconds * 1000;

  let clock = 0;
  let last = performance.now();
  let speed = 1;
  let covered = false;
  let textAll = false; // 跳過時所有字直接顯示
  let parts = [];

  const skip = () => {
    if (clock < burnStart) { textAll = true; burnStart = Math.max(clock, fade); } else speed = 3;
  };
  cv.addEventListener('pointerdown', skip);
  document.addEventListener('keydown', skip);

  const cover = () => {
    if (covered) return;
    covered = true;
    try { onCovered?.(); } catch { /* 底下切換失敗也要把動畫播完 */ }
  };

  // 布幕：星空＋會閃的星＋字
  function drawCurtain(e) {
    cc.globalAlpha = 1;
    cc.clearRect(0, 0, w, h);
    cc.drawImage(sky, 0, 0, w, h);
    for (const s of twinkles) {
      const a = reduced ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((e / 1000) * s.sp * 3.14 + s.ph));
      const gr = cc.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
      gr.addColorStop(0, `rgba(${s.c},${a})`);
      gr.addColorStop(0.25, `rgba(${s.c},${a * 0.35})`);
      gr.addColorStop(1, `rgba(${s.c},0)`);
      cc.fillStyle = gr;
      cc.fillRect(s.x - s.r * 4, s.y - s.r * 4, s.r * 8, s.r * 8);
    }
    cc.font = `${fs}px ${FONT}`;
    cc.textBaseline = 'middle';
    cc.fillStyle = '#f6f2ec';
    cc.shadowColor = 'rgba(190,205,255,.35)';
    cc.shadowBlur = 18;
    for (const c of chars) {
      const a = textAll ? 1 : reduced ? clamp01((e - 600) / 300) : clamp01((e - c.t0) / 420);
      if (a <= 0) continue;
      const k = 1 - Math.pow(1 - a, 3);
      cc.globalAlpha = k;
      cc.fillText(c.ch, c.x, c.y + (1 - k) * fs * 0.1);
    }
    cc.shadowBlur = 0;
    cc.globalAlpha = 1;
  }

  // 燃燒：依進度把每一格分成「已燒掉／火線／焦邊／還沒燒」，再疊上光暈
  function drawBurn(p) {
    const s = (-(Math.cos(Math.PI * p) - 1) / 2) * 1.12 - 0.04;
    const m = mD.data; const g = gD.data; const cd = cD.data; const spawn = parts.length < 380;
    for (let y = 0, i = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++, i++) {
        const d = base[i] - s; const j = i * 4;
        if (d < -0.022) { m[j + 3] = 0; g[j + 3] = 0; cd[j + 3] = 0; } else if (d < 0) {
          // 剛燒穿：殘留一點暗紅餘光
          const k = 1 + d / 0.022;
          m[j + 3] = 0; cd[j + 3] = 0;
          g[j] = 210; g[j + 1] = 52; g[j + 2] = 12; g[j + 3] = 150 * k * k;
        } else if (d < E1) {
          // 火線：亮黃到橘
          const k = d / E1;
          m[j + 3] = 255; cd[j + 3] = 0;
          g[j] = 255; g[j + 1] = 236 - 126 * k; g[j + 2] = 170 - 145 * k; g[j + 3] = 255;
          if (spawn && Math.random() < 0.0022) parts.push({ x: (x + 0.5) * C, y: (y + 0.5) * C, vx: (Math.random() - 0.5) * 24, vy: -(30 + Math.random() * 80), life: 0, max: 0.6 + Math.random(), r: 0.6 + Math.random() * 1.6 });
        } else if (d < E2) {
          // 焦邊：越靠近火線越黑
          const k = (d - E1) / (E2 - E1);
          m[j + 3] = 255;
          cd[j] = 34; cd[j + 1] = 13; cd[j + 2] = 6; cd[j + 3] = 255 * Math.pow(1 - k, 0.6);
          g[j] = 190; g[j + 1] = 44; g[j + 2] = 6; g[j + 3] = 140 * (1 - k) * (1 - k);
        } else { m[j + 3] = 255; g[j + 3] = 0; cd[j + 3] = 0; }
      }
    }
    mask.getContext('2d').putImageData(mD, 0, 0);
    glow.getContext('2d').putImageData(gD, 0, 0);
    char.getContext('2d').putImageData(cD, 0, 0);
    const bc = bloom.getContext('2d');
    bc.clearRect(0, 0, bloom.width, bloom.height);
    bc.drawImage(glow, 0, 0, bloom.width, bloom.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(char, 0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glow, 0, 0, w, h);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(bloom, 0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // 往上飄的餘燼
  function drawParts(dt) {
    ctx.globalCompositeOperation = 'lighter';
    parts = parts.filter((q) => (q.life += dt) < q.max);
    for (const q of parts) {
      q.vy -= 40 * dt; q.vx += (Math.random() - 0.5) * 90 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const a = 1 - q.life / q.max;
      ctx.fillStyle = `rgba(255,${(150 + 80 * a) | 0},${(60 * a) | 0},${a})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  await new Promise((resolve) => {
    const frame = (now) => {
      const dt = Math.min(0.2, (now - last) / 1000) * speed; // 掉格時照實際時間前進，只有切到背景太久才封頂
      last = now;
      clock += dt * 1000;
      drawCurtain(clock);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = clamp01(clock / fade);
      ctx.drawImage(curtain, 0, 0, w, h);
      ctx.globalAlpha = 1;
      if (clock >= fade) cover();

      const be = clock - burnStart;
      if (be >= 0) {
        const p = clamp01(be / burnDur);
        if (reduced) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.globalAlpha = p;
          ctx.fillRect(0, 0, w, h);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        } else drawBurn(p);
      }
      drawParts(Math.min(0.05, dt)); // 粒子每步最多 0.05 秒，掉格時才不會亂飛
      if (be > burnDur && !parts.length) { resolve(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame((now) => { last = now; frame(now); });
  });

  cv.removeEventListener('pointerdown', skip);
  document.removeEventListener('keydown', skip);
  cv.remove();
}
