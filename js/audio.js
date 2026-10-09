// 白噪音：播放使用者自備的 mp3（assets/audio/），定時關閉淡出
// 播放引擎以「聲道」管理，單軌模式只允許 1 個聲道，混音模式（M5）最多 2 個

export const TIMER_OPTIONS = [0, 15, 30, 60];
export const FADE_SECONDS = 3;
export const MAX_MIX = 2;
export const SAFE_FILE = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,80}\.mp3$/;

// 把尾端 fade 個取樣交叉淡入到開頭，回傳長度少 fade 的陣列；循環播放時頭尾連續、不爆音
export function crossfadeLoop(data, fade) {
  const length = data.length - fade;
  const out = data.slice(0, length);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    out[i] = data[i] * Math.sqrt(t) + data[length + i] * Math.sqrt(1 - t);
  }
  return out;
}

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

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.channels = new Map(); // trackId → { source, gain, volume }
    this.buffers = new Map();
    this.maxChannels = 1;
    this.volume = 0.5;
    this.timer = null;
    this.timerEnd = 0;
    this.onChange = () => {};
  }

  // 必須在使用者點擊時呼叫（瀏覽器規定）
  async ensure() {
    if (!this.ctx) {
      const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  async buffer(track) {
    if (this.buffers.has(track.id)) return this.buffers.get(track.id);
    const res = await fetch(`assets/audio/${track.file}`);
    if (!res.ok) throw new Error('missing');
    const decoded = await this.ctx.decodeAudioData(await res.arrayBuffer());
    // mp3 頭尾常有編碼器補的靜音，交叉淡入可避免接縫爆音或停頓
    const fade = Math.min(Math.floor(decoded.sampleRate * 0.25), Math.floor(decoded.length / 4));
    const buf = this.ctx.createBuffer(decoded.numberOfChannels, decoded.length - fade, decoded.sampleRate);
    for (let c = 0; c < decoded.numberOfChannels; c++) buf.copyToChannel(crossfadeLoop(decoded.getChannelData(c), fade), c);
    this.buffers.set(track.id, buf);
    return buf;
  }

  get playing() { return this.channels.size > 0 && this.ctx?.state === 'running'; }
  get activeIds() { return [...this.channels.keys()]; }

  // 加入一個聲道；單軌時會先替換掉原本的聲道。回傳 { ok, reason }
  async play(track, { replace = true, volume = 1 } = {}) {
    await this.ensure();
    if (this.channels.has(track.id)) return { ok: true };
    if (this.channels.size >= this.maxChannels) {
      if (replace && this.maxChannels === 1) this.stopAll();
      else return { ok: false, reason: `最多同時播放 ${this.maxChannels} 軌。` };
    }
    const buf = await this.buffer(track);
    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.master);
    source.start();
    this.channels.set(track.id, { source, gain, volume });
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.onChange();
    return { ok: true };
  }

  stop(trackId) {
    const ch = this.channels.get(trackId);
    if (!ch) return;
    try { ch.source.stop(); } catch { /* 已停止 */ }
    ch.source.disconnect();
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
