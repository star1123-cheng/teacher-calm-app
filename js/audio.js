// 白噪音：播放使用者自備的 mp3（assets/audio/），定時關閉淡出
// 用 <audio> 邊下載邊播（不必整首下載解碼），再接到 Web Audio 的音量節點：iPhone 只能這樣調音量與淡出
// 播放引擎以「聲道」管理，單軌模式只允許 1 個聲道，混音模式（M5）最多 2 個
// 循環接縫：轉檔時已把頭尾交叉淡入做進音檔裡（見 docs/audio.md）

export const TIMER_OPTIONS = [0, 15, 30, 60];
export const FADE_SECONDS = 3;
export const MAX_MIX = 2;
export const SAFE_FILE = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,80}\.mp3$/;

export function sanitizeManifest(json) {
  const list = Array.isArray(json?.tracks) ? json.tracks : [];
  return list
    .filter((t) => t && typeof t.file === 'string' && SAFE_FILE.test(t.file) && typeof t.name === 'string' && t.name.trim())
    .slice(0, 20)
    .map((t) => ({ id: `file:${t.file}`, name: t.name.trim().slice(0, 30), file: t.file }));
}

async function fileExists(url) {
  try {
    if (globalThis.caches && await caches.match(url)) return true;
    const res = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loadFileTracks() {
  try {
    const res = await fetch('assets/audio/manifest.json');
    if (!res.ok) return [];
    const tracks = sanitizeManifest(await res.json());
    const ok = await Promise.all(tracks.map((t) => fileExists(`assets/audio/${t.file}`)));
    return tracks.filter((_, i) => ok[i]);
  } catch {
    return [];
  }
}

// 名稱要和 sw.js 的 AUDIO_CACHE 一致
export const AUDIO_CACHE = 'tcalm-audio-v1';

// 在背景一次一首把音檔存進離線快取：之後點播放直接從手機讀、斷網也能播
// 不在清單上的舊音檔順便刪掉，避免佔空間
export async function warmAudioCache(files) {
  if (!globalThis.caches) return;
  try {
    const cache = await caches.open(AUDIO_CACHE);
    const want = new Set(files.map((f) => new URL(`assets/audio/${f}`, location.href).href));
    for (const req of await cache.keys()) if (!want.has(req.url)) await cache.delete(req);
    for (const url of want) {
      if (await cache.match(url)) continue;
      try { await cache.add(url); } catch { /* 網路不通就下次再存 */ }
    }
  } catch { /* 瀏覽器不給用快取（例如私密模式）就算了，照樣可以線上播 */ }
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.channels = new Map(); // trackId → { audio, gain, volume }
    this.players = new Map(); // trackId → { audio, gain }：同一個 <audio> 只能接上 Web Audio 一次，所以重複使用
    this.maxChannels = 1;
    this.volume = 0.5;
    this.timer = null;
    this.timerEnd = 0;
    this.onChange = () => {};
  }

  // 建立播放環境；還沒點擊前建立的會是暫停狀態
  context() {
    if (!this.ctx) {
      const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.ctx.onstatechange = () => this.onChange();
    }
    return this.ctx;
  }

  // 必須在使用者點擊「當下」呼叫，中間不能先 await 其他東西（iPhone 規定）
  unlock() {
    const ctx = this.context();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  }

  // 把一個 <audio> 接到指定的音量節點，回傳控制它音量的 GainNode
  connect(audio, output, volume = 1) {
    const ctx = this.context();
    const gain = ctx.createGain();
    gain.gain.value = volume;
    ctx.createMediaElementSource(audio).connect(gain).connect(output || this.master);
    return gain;
  }

  player(track) {
    if (!this.players.has(track.id)) {
      const audio = new Audio();
      audio.loop = true;
      audio.preload = 'auto';
      audio.src = `assets/audio/${track.file}`;
      this.players.set(track.id, { audio, gain: this.connect(audio) });
    }
    return this.players.get(track.id);
  }

  get playing() { return this.channels.size > 0 && this.ctx?.state === 'running'; }
  get activeIds() { return [...this.channels.keys()]; }

  // 加入一個聲道；單軌時會先替換掉原本的聲道。回傳 Promise<{ ok, reason }>
  // 不是 async：播放指令要在點擊當下同步送出，瀏覽器才會放行
  play(track, { replace = true, volume = 1 } = {}) {
    this.unlock();
    if (this.channels.has(track.id)) return Promise.resolve({ ok: true });
    if (this.channels.size >= this.maxChannels) {
      if (replace && this.maxChannels === 1) this.stopAll();
      else return Promise.resolve({ ok: false, reason: `最多同時播放 ${this.maxChannels} 軌。` });
    }
    const { audio, gain } = this.player(track);
    gain.gain.value = volume;
    audio.currentTime = 0;
    const started = audio.play();
    this.channels.set(track.id, { audio, gain, volume });
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.onChange();
    return Promise.resolve(started).then(() => ({ ok: true }), (err) => { this.stop(track.id); throw err; });
  }

  stop(trackId) {
    const ch = this.channels.get(trackId);
    if (!ch) return;
    ch.audio.pause();
    this.channels.delete(trackId);
    if (!this.channels.size) this.clearTimer();
    this.onChange();
  }

  stopAll() { for (const id of this.activeIds) this.stop(id); }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  setChannelVolume(trackId, v) {
    const ch = this.channels.get(trackId);
    if (ch) { ch.volume = v; ch.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  }

  // 定時關閉：到時前 3 秒開始淡出，結束後停止
  setTimer(ms) {
    this.clearTimer();
    if (!ms) { this.onChange(); return; }
    this.timerEnd = Date.now() + ms;
    const fadeAt = Math.max(0, ms - FADE_SECONDS * 1000);
    this.timer = setTimeout(() => this.fadeOutAndStop(), fadeAt);
    this.onChange();
  }

  fadeOutAndStop(seconds = FADE_SECONDS) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + seconds);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.timerEnd = 0;
      this.stopAll();
      this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.onChange();
    }, seconds * 1000);
  }

  clearTimer() {
    clearTimeout(this.timer);
    this.timer = null;
    this.timerEnd = 0;
  }
}
