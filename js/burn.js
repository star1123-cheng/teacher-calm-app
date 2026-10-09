// 地獄轉場「燒幕」：宣紙上一個字一個字浮現黑色行書，蓋上紅色印章，
// 接著畫面由下往上燃燒，像燒掉一張布幕一樣揭開底下的地獄模式。
// 全部用 canvas 即時畫出來（不需要圖片）；點一下或按任意鍵：寫字中直接開始燒，燒的時候加速。

export const LINES = ['我常在開心的時候感到難過', '因為我不知道可以開心多久'];
const SEAL = '地獄';
const FONT = '"TcalmBrush", "DFKai-SB", "BiauKai", "Kaiti TC", serif';
const INK = '#16110f';

// 各段時間（毫秒）
const T = { fadeIn: 550, perChar: 100, charDur: 560, seal: 380, hold: 1300, burn: 3400, tail: 1100 };

const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// 平滑的隨機起伏（數值雜訊，疊 4 層），回傳 0～1；用來做燃燒邊緣的不規則形狀
function makeNoise() {
  const p = Float32Array.from({ length: 512 }, Math.random);
  const n1 = (x) => {
    const i = Math.floor(x);
    const a = p[i & 511];
    return a + (p[(i + 1) & 511] - a) * smooth(x - i);
  };
  return (x, t = 0) => {
    let v = 0;
    let amp = 0.5;
    let f = 1;
    for (let o = 0; o < 4; o++) {
      v += amp * n1(x * f + t * (o + 1) * 0.7 + o * 37.1);
      amp *= 0.5;
      f *= 2.03;
    }
    return v / 0.9375;
  };
}

// 宣紙：暖白底、四周微暗、纖維與斑點紋理
function makePaper(w, h, dpr) {
  const c = makeCanvas(w * dpr, h * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const base = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.1, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  base.addColorStop(0, '#f4ecd9');
  base.addColorStop(0.6, '#eadfc5');
  base.addColorStop(1, '#c8b38c');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  // 淡淡的水漬
  for (let i = 0; i < 7; i++) {
    const x = rand(0, w); const y = rand(0, h); const r = rand(60, 220);
    const s = g.createRadialGradient(x, y, 0, x, y, r);
    s.addColorStop(0, 'rgba(150, 120, 80, .06)');
    s.addColorStop(1, 'rgba(150, 120, 80, 0)');
    g.fillStyle = s;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 纖維：短短的彎線，有深有淺
  const n = Math.min(6000, Math.round((w * h) / 170));
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rand(0, w); const y = rand(0, h); const len = rand(5, 28); const a = rand(0, Math.PI * 2);
    const light = Math.random() < 0.35;
    g.strokeStyle = light ? `rgba(255, 252, 244, ${rand(0.15, 0.35)})` : `rgba(110, 85, 55, ${rand(0.03, 0.09)})`;
    g.lineWidth = rand(0.3, 1);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.6) * len * 0.5, y + Math.sin(a + 0.6) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  // 細小斑點
  for (let i = 0; i < n / 3; i++) {
    g.fillStyle = `rgba(90, 70, 45, ${rand(0.04, 0.12)})`;
    g.fillRect(rand(0, w), rand(0, h), rand(0.4, 1.4), rand(0.4, 1.4));
  }
  return c;
}

// 排版：直式畫面寫成兩直行（由右到左），橫式畫面寫成兩橫行；每個字帶一點手寫的歪斜與大小差
function layout(w, h) {
  const vertical = h > w * 1.05;
  const count = Math.max(...LINES.map((l) => l.length));
  const chars = [];
  let size;
  let seal;
  if (vertical) {
    size = Math.min((h * 0.68) / count, w * 0.17);
    const step = size * 1.03;
    const gap = size * 1.55;
    const top = (h - step * count) / 2 - size * 0.25;
    LINES.forEach((line, i) => {
      const x = w / 2 + (i === 0 ? gap / 2 : -gap / 2);
      const y0 = top + (i ? size * 0.55 : 0) + size / 2; // 第二行稍微往下錯開，像真的寫字
      [...line].forEach((ch, j) => chars.push({ ch, x, y: y0 + j * step }));
    });
    const last = chars.at(-1);
    seal = { x: last.x, y: Math.min(h - size * 0.7, last.y + size * 1.45) };
  } else {
    size = Math.min((w * 0.76) / (count + 0.6), h * 0.11);
    const step = size * 1.03;
    const left = (w - step * (count + 0.6)) / 2 + size / 2;
    LINES.forEach((line, i) => {
      const y = h / 2 + (i === 0 ? -size * 0.78 : size * 0.78);
      const x0 = left + (i ? size * 0.6 : 0);
      [...line].forEach((ch, j) => chars.push({ ch, x: x0 + j * step, y }));
    });
    const last = chars.at(-1);
    seal = { x: Math.min(w - size * 0.6, last.x + size * 1.25), y: last.y + size * 0.2 };
  }
  for (const c of chars) {
    c.size = size * rand(0.93, 1.09);
    c.rot = rand(-0.045, 0.045);
    c.x += rand(-0.035, 0.035) * size;
    c.y += rand(-0.03, 0.03) * size;
  }
  seal.size = size * 0.62;
  return { chars, seal, size };
}

// 畫一個字：p 從 0 到 1，筆墨由左上往右下掃出來（約略像筆順），邊緣帶一點墨暈
function drawChar(g, tmp, c, p) {
  const S = tmp.width;
  const t = tmp.getContext('2d');
  t.globalCompositeOperation = 'source-over';
  t.clearRect(0, 0, S, S);
  t.save();
  t.translate(S / 2, S / 2);
  t.rotate(c.rot);
  t.font = `${c.size}px ${FONT}`;
  t.textAlign = 'center';
  t.textBaseline = 'middle';
  t.fillStyle = INK;
  t.fillText(c.ch, 0, 0);
  t.restore();
  if (p < 1) {
    const e = p * 1.35;
    const grad = t.createLinearGradient(0, 0, S, S * 0.85);
    grad.addColorStop(clamp01(e - 0.3), 'rgba(0, 0, 0, 1)');
    grad.addColorStop(clamp01(e), 'rgba(0, 0, 0, 0)');
    t.globalCompositeOperation = 'destination-in';
    t.fillStyle = grad;
    t.fillRect(0, 0, S, S);
  }
  const x = c.x - S / 2;
  const y = c.y - S / 2;
  const d = c.size * 0.014;
  g.save();
  g.globalCompositeOperation = 'multiply';
  // 墨暈：四個方向各偏一點點、很淡；剛下筆時暈得比較開
  g.globalAlpha = 0.16 + 0.1 * (1 - p);
  const spread = d * (1 + 1.6 * (1 - p));
  for (let k = 0; k < 4; k++) g.drawImage(tmp, x + Math.cos(k * 1.57 + 0.4) * spread, y + Math.sin(k * 1.57 + 0.4) * spread);
  g.globalAlpha = 0.94;
  g.drawImage(tmp, x, y);
  g.restore();
}

// 紅色印章「地獄」：邊緣不平整、印泥有深有淺，字是留白
function makeSeal(size) {
  const W = size;
  const H = size * 1.75;
  const pad = size * 0.2;
  const c = makeCanvas(W + pad * 2, H + pad * 2);
  const g = c.getContext('2d');
  g.translate(pad, pad);
  g.fillStyle = '#b8261b';
  g.beginPath();
  const pts = 40;
  for (let i = 0; i <= pts; i++) {
    const u = i / pts;
    let x; let y;
    if (u < 0.25) { x = W * (u / 0.25); y = 0; } else if (u < 0.5) { x = W; y = H * ((u - 0.25) / 0.25); } else if (u < 0.75) { x = W * (1 - (u - 0.5) / 0.25); y = H; } else { x = 0; y = H * (1 - (u - 0.75) / 0.25); }
    x += rand(-1, 1) * size * 0.025;
    y += rand(-1, 1) * size * 0.025;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.font = `${size * 0.7}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#000';
  g.fillText(SEAL[0], W / 2, H * 0.28);
  g.fillText(SEAL[1], W / 2, H * 0.72);
  // 印泥不均：隨機小缺口
  for (let i = 0; i < 70; i++) {
    g.globalAlpha = rand(0.2, 0.7);
    g.beginPath();
    g.arc(rand(0, W), rand(0, H), rand(0.3, size * 0.035), 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function drawSeal(g, img, seal, p) {
  const k = 1 + 0.35 * (1 - smooth(p)); // 蓋下去：由大縮到原尺寸
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 0.92 * clamp01(p * 1.6);
  g.translate(seal.x, seal.y);
  g.rotate(-0.03);
  g.scale(k, k);
  g.drawImage(img, -img.width / 2, -img.height / 2);
  g.restore();
}

// 焦痕：14 層由寬到窄、由淡黃褐到焦黑的線疊起來，看起來像連續的漸層
const SCORCH = Array.from({ length: 14 }, (_, i) => {
  const t = i / 13;
  const lw = 8 + 190 * Math.pow(1 - t, 1.6);
  const r = Math.round(150 - 135 * t);
  const g = Math.round(105 - 95 * t);
  const b = Math.round(50 - 44 * t);
  return [lw, `rgba(${r}, ${g}, ${b}, ${(0.05 + 0.2 * t * t).toFixed(3)})`];
});

function trace(g, pts) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
}

// 回傳 Promise：動畫全部結束、畫布移除後 resolve
// onCovered：布幕完全蓋住畫面時呼叫（此時切換底下的模式，使用者看不到）
export async function playBurn({ onCovered } = {}) {
  // 字型最多等 0.8 秒，避免第一次播放時字跳出預設字體
  try { await Promise.race([document.fonts?.load(`64px ${FONT}`, LINES.join('') + SEAL), wait(800)]); } catch { /* 用備用字體 */ }

  const w = window.innerWidth;
  const h = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (w * h * dpr * dpr > 4e6) dpr = Math.sqrt(4e6 / (w * h)); // 大螢幕降低解析度，避免卡頓

  const cv = makeCanvas(w * dpr, h * dpr);
  cv.className = 'burn';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', LINES.join('，'));
  const ctx = cv.getContext('2d');
  document.body.append(cv);
  document.getElementById('toast')?.classList.remove('show');

  const curtain = makePaper(w, h, dpr);
  const cg = curtain.getContext('2d');
  const { chars, seal, size } = layout(w, h);
  const tmp = makeCanvas(size * 1.7, size * 1.7);
  const sealImg = makeSeal(seal.size);
  const noise = makeNoise();
  const noise2 = makeNoise();
  chars.forEach((c, i) => { c.start = T.fadeIn + i * T.perChar; c.baked = false; });
  const writeEnd = T.fadeIn + (chars.length - 1) * T.perChar + T.charDur;
  const sealStart = writeEnd + 120;
  let sealBaked = false;
  let burnStart = sealStart + T.seal + T.hold;

  let clock = 0;
  let last = performance.now();
  let speed = 1;
  let covered = false;
  const embers = [];
  const ash = [];
  const smoke = [];
  const holes = [];
  const amp = Math.max(36, h * 0.085);
  const step = w > 900 ? 6 : 5;
  // 焦痕畫在 1/6 解析度的小畫布再放大：放大時自動暈開，層與層之間不會有條紋
  const LOW = 6;
  const scorchCv = makeCanvas(w / LOW + 2, h / LOW + 2);
  const sg = scorchCv.getContext('2d');

  const bakeAll = () => {
    for (const c of chars) if (!c.baked) { drawChar(cg, tmp, c, 1); c.baked = true; }
    if (!sealBaked) { drawSeal(cg, sealImg, seal, 1); sealBaked = true; }
  };
  const skip = () => {
    if (clock < burnStart) { bakeAll(); burnStart = clock; } else speed = 3;
  };
  cv.addEventListener('pointerdown', skip);
  document.addEventListener('keydown', skip);

  const cover = () => {
    if (covered) return;
    covered = true;
    try { onCovered?.(); } catch { /* 底下切換失敗也要把動畫播完 */ }
  };

  // 燃燒邊緣：底線往上推，加上大起伏與細碎鋸齒
  function front(y0, ts) {
    const pts = [];
    for (let x = -step; x <= w + step; x += step) {
      const big = (noise(x / 230, ts * 0.22) - 0.5) * 2 * amp;
      const fine = (noise2(x / 26, ts * 0.9) - 0.5) * amp * 0.22;
      pts.push(x, y0 + big + fine);
    }
    return pts;
  }
  const frontY = (pts, x) => pts[Math.max(0, Math.min(pts.length / 2 - 1, Math.round((x + step) / step))) * 2 + 1];

  function holePath(hole) {
    const pts = [];
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2;
      const r = hole.r * (0.72 + 0.56 * noise(hole.seed + k * 0.6, hole.age * 0.5));
      pts.push(hole.x + Math.cos(a) * r, hole.y + Math.sin(a) * r * 0.85);
    }
    pts.push(pts[0], pts[1]);
    return pts;
  }

  function spawn(pts, dt, burning) {
    if (!burning) return;
    const visible = [];
    for (let i = 0; i < pts.length; i += 2) if (pts[i + 1] > -20 && pts[i + 1] < h + 20) visible.push(i);
    if (!visible.length) return;
    const pick = () => { const i = visible[Math.floor(Math.random() * visible.length)]; return [pts[i], pts[i + 1]]; };
    const k = (w / 400) * dt;
    for (let n = Math.round(110 * k * rand(0.6, 1.4)); n > 0 && embers.length < 420; n--) {
      const [x, y] = pick();
      embers.push({ x, y, vx: rand(-25, 25), vy: rand(-220, -60), life: rand(0.5, 1.7), age: 0, size: rand(0.7, 2.2), seed: rand(0, 10) });
    }
    for (let n = Math.round(14 * k * rand(0, 2)); n > 0 && ash.length < 70; n--) {
      const [x, y] = pick();
      ash.push({ x, y, vx: rand(-20, 20), vy: rand(-80, -25), life: rand(1.4, 2.8), age: 0, size: rand(2, 6.5), rot: rand(0, 6), vr: rand(-4, 4), hot: Math.random() < 0.35 });
    }
    for (let n = Math.round(4 * k * rand(0, 2)); n > 0 && smoke.length < 24; n--) {
      const [x, y] = pick();
      smoke.push({ x, y, vx: rand(-10, 10), vy: rand(-45, -20), life: rand(1.6, 2.8), age: 0, r: rand(25, 60) });
    }
  }

  function updateParticles(dt, ts) {
    for (const list of [embers, ash, smoke]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age += dt;
        if (p.age >= p.life) { list.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (list === embers) { p.vx += Math.sin(ts * 4 + p.seed) * 60 * dt; p.vy -= 40 * dt; }
        if (list === ash) { p.rot += p.vr * dt; p.vx += Math.sin(ts * 2 + p.rot) * 15 * dt; }
        if (list === smoke) p.r += 22 * dt;
      }
    }
  }

  function drawParticles() {
    ctx.globalCompositeOperation = 'source-over';
    for (const s of smoke) {
      const a = 0.09 * Math.sin((s.age / s.life) * Math.PI);
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(55, 45, 42, ${a})`);
      g.addColorStop(1, 'rgba(55, 45, 42, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    for (const a of ash) {
      const f = a.age / a.life;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      ctx.globalAlpha = (1 - f) * 0.85;
      ctx.fillStyle = '#1e1714';
      ctx.beginPath();
      ctx.moveTo(-a.size, -a.size * 0.4);
      ctx.lineTo(a.size * 0.7, -a.size * 0.6);
      ctx.lineTo(a.size, a.size * 0.5);
      ctx.lineTo(-a.size * 0.5, a.size * 0.6);
      ctx.closePath();
      ctx.fill();
      if (a.hot && f < 0.6) {
        ctx.strokeStyle = `rgba(255, 130, 40, ${(0.6 - f) * 1.4})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      const f = e.age / e.life;
      const rgb = f < 0.25 ? '255, 236, 180' : f < 0.6 ? '255, 160, 60' : '220, 70, 20';
      ctx.fillStyle = `rgba(${rgb}, ${(1 - f) * 0.95})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * (1 - f * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBurn(bp, ts, dt) {
    const y0 = h + amp + 10 - Math.pow(bp, 1.15) * (h + amp * 3 + 60);
    const pts = front(y0, ts);

    // 新的燒穿小洞：出現在火線前方一小段，慢慢擴大，最後被火線吞掉
    if (bp > 0.06 && bp < 0.85 && holes.length < 7 && Math.random() < dt * 2.2) {
      const x = rand(0, w);
      const y = frontY(pts, x) - rand(h * 0.05, h * 0.2);
      if (y > 0) holes.push({ x, y, r: 1, grow: rand(22, 55), age: 0, seed: rand(0, 50) });
    }
    for (let i = holes.length - 1; i >= 0; i--) {
      const o = holes[i];
      o.age += dt;
      o.r += o.grow * dt;
      if (o.y - o.r > frontY(pts, o.x) + 30) holes.splice(i, 1);
    }
    const hp = holes.map(holePath);

    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(curtain, 0, 0, w, h);

    // 焦痕：只畫在還沒燒掉的紙上，越靠近火線越黑
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, scorchCv.width, scorchCv.height);
    sg.setTransform(1 / LOW, 0, 0, 1 / LOW, 0, 0);
    sg.lineJoin = 'round';
    sg.lineCap = 'round';
    for (const [lw, color] of SCORCH) {
      sg.strokeStyle = color;
      sg.lineWidth = lw;
      trace(sg, pts);
      sg.stroke();
      for (const p of hp) { sg.lineWidth = lw * 0.35; trace(sg, p); sg.stroke(); }
    }
    ctx.globalCompositeOperation = 'source-atop';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(scorchCv, 0, 0, scorchCv.width * LOW, scorchCv.height * LOW);
    // 緊貼火線的焦黑細邊用原解析度畫，邊緣才俐落
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(14, 8, 5, .9)';
    ctx.lineWidth = 7;
    trace(ctx, pts);
    ctx.stroke();
    for (const p of hp) { ctx.lineWidth = 4; trace(ctx, p); ctx.stroke(); }

    // 燒掉：火線以下和小洞挖空，露出底下的地獄模式
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    trace(ctx, pts);
    ctx.lineTo(w + step, h + 10);
    ctx.lineTo(-step, h + 10);
    ctx.closePath();
    ctx.fill();
    for (const p of hp) { trace(ctx, p); ctx.fill(); }

    // 火光映在剛露出的畫面上
    ctx.globalCompositeOperation = 'source-over';
    const glow = ctx.createLinearGradient(0, y0 - amp, 0, y0 + amp * 1.5 + 120);
    glow.addColorStop(0, 'rgba(255, 110, 30, .28)');
    glow.addColorStop(1, 'rgba(255, 60, 10, 0)');
    ctx.fillStyle = glow;
    trace(ctx, pts);
    ctx.lineTo(w + step, h + 10);
    ctx.lineTo(-step, h + 10);
    ctx.closePath();
    ctx.fill();

    // 火線：外層橘紅、內層亮黃，整體會閃爍
    ctx.globalCompositeOperation = 'lighter';
    const flicker = 0.78 + 0.22 * noise2(ts * 6);
    const lines = [[20, `rgba(255, 70, 10, ${0.16 * flicker})`], [9, `rgba(255, 110, 25, ${0.4 * flicker})`], [3.5, `rgba(255, 180, 70, ${0.85 * flicker})`], [1.3, `rgba(255, 245, 210, ${0.9 * flicker})`]];
    for (const [lw, color] of lines) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      trace(ctx, pts);
      ctx.stroke();
      for (const p of hp) { ctx.lineWidth = lw * 0.6; trace(ctx, p); ctx.stroke(); }
    }
    // 沿著火線忽明忽暗的熱點
    const K = Math.max(6, Math.round(w / 70));
    for (let k = 0; k < K; k++) {
      const x = ((k + noise(k * 3.1, ts * 0.3)) / K) * w;
      const y = frontY(pts, x);
      const it = Math.pow(noise2(k * 7.3, ts * 1.8), 2);
      const r = 10 + 26 * it;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255, 200, 90, ${0.55 * it})`);
      g.addColorStop(1, 'rgba(255, 90, 20, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return pts;
  }

  await new Promise((resolve) => {
    let burnEnd = 0;
    const frame = (now) => {
      const dt = Math.min(0.2, (now - last) / 1000) * speed; // 掉格時照實際時間前進，只有切到背景太久才封頂
      last = now;
      clock += dt * 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);

      if (clock < burnStart) {
        // 寫字階段：寫完的字直接畫進布幕，正在寫的字每格重畫
        for (const c of chars) {
          const p = (clock - c.start) / T.charDur;
          if (!c.baked && p >= 1) { drawChar(cg, tmp, c, 1); c.baked = true; }
        }
        const sp = (clock - sealStart) / T.seal;
        if (!sealBaked && sp >= 1) { drawSeal(cg, sealImg, seal, 1); sealBaked = true; }
        const a = smooth(clamp01(clock / T.fadeIn));
        ctx.globalAlpha = a;
        ctx.drawImage(curtain, 0, 0, w, h);
        ctx.globalAlpha = 1;
        for (const c of chars) {
          const p = (clock - c.start) / T.charDur;
          if (!c.baked && p > 0) drawChar(ctx, tmp, c, p);
        }
        if (!sealBaked && sp > 0) drawSeal(ctx, sealImg, seal, sp);
        if (a >= 1) cover();
      } else {
        cover();
        const ts = (clock - burnStart) / 1000;
        const bp = clamp01((clock - burnStart) / T.burn);
        if (bp < 1) {
          const pts = drawBurn(bp, ts, dt);
          spawn(pts, dt, true);
        } else if (!burnEnd) burnEnd = clock;
        updateParticles(dt, ts);
        drawParticles();
        if (burnEnd && (clock - burnEnd > T.tail || (!embers.length && !ash.length && !smoke.length))) { resolve(); return; }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame((now) => { last = now; frame(now); });
  });

  cv.removeEventListener('pointerdown', skip);
  document.removeEventListener('keydown', skip);
  cv.remove();
}
