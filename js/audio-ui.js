// 白噪音介面：單軌（選擇音源＋播放）或混音（最多 2 軌、各自音量）；共用總音量與定時關閉
import { AudioEngine, SYNTH_TRACKS, TIMER_OPTIONS, MAX_MIX, loadFileTracks } from './audio.js';
import { getSettings, saveSettings } from './storage.js';
import { el, toast } from './ui.js';

export const engine = new AudioEngine();

export function initAudio(root = document.getElementById('audio')) {
  const settings = getSettings();
  engine.volume = settings.audio.volume;
  // 先顯示合成噪音，音檔清單檢查完再補上，避免拖慢首頁
  const tracks = [...SYNTH_TRACKS];
  const byId = new Map(tracks.map((t) => [t.id, t]));

  const persist = (patch) => {
    const s = getSettings();
    s.audio = { ...s.audio, ...patch };
    saveSettings(s);
  };

  // 單軌控制
  const trackSel = el('select', { id: 'audio-track' });
  const playBtn = el('button', { type: 'button', text: '播放', 'aria-pressed': 'false' });
  const single = el('p', {}, el('label', { for: 'audio-track', text: '音源' }), ' ', trackSel, ' ', playBtn);
  // 混音控制
  const mixer = el('ul', { class: 'mixer', 'aria-label': `混音（最多 ${MAX_MIX} 軌）` });
  const stopAllBtn = el('button', { type: 'button', text: '全部停止' });
  const mixBox = el('div', { hidden: true }, mixer, el('p', {}, stopAllBtn));
  // 共用
  const vol = el('input', { type: 'range', id: 'audio-vol', min: '0', max: '1', step: '0.05' });
  vol.value = String(engine.volume);
  const timerSel = el('select', { id: 'audio-timer' },
    TIMER_OPTIONS.map((m) => el('option', { value: String(m), text: m ? `${m} 分鐘後關閉` : '不定時' })));
  const status = el('p', { class: 'muted', 'aria-live': 'polite' });

  root.append(single, mixBox,
    el('p', {}, el('label', { for: 'audio-vol', text: '總音量' }), ' ', vol),
    el('p', {}, el('label', { for: 'audio-timer', text: '定時' }), ' ', timerSel),
    status);

  function fillTracks() {
    const synth = tracks.filter((t) => t.synth);
    const files = tracks.filter((t) => !t.synth);
    trackSel.replaceChildren(
      el('optgroup', { label: '合成' }, synth.map((t) => el('option', { value: t.id, text: t.name }))),
      files.length ? el('optgroup', { label: '音檔' }, files.map((t) => el('option', { value: t.id, text: t.name }))) : null,
    );
    if (byId.has(getSettings().audio.lastTrack)) trackSel.value = getSettings().audio.lastTrack;
    mixer.replaceChildren(...tracks.map((t) => {
      const btn = el('button', { type: 'button', 'data-id': t.id, 'aria-pressed': 'false', text: t.name });
      const v = el('input', { type: 'range', min: '0', max: '1', step: '0.05', 'aria-label': `${t.name} 音量`, 'data-vol': t.id });
      v.value = '1';
      btn.addEventListener('click', () => toggleMix(t, v));
      v.addEventListener('input', () => engine.setChannelVolume(t.id, Number(v.value)));
      return el('li', {}, btn, ' ', v);
    }));
    render();
  }

  function render() {
    const on = engine.playing;
    playBtn.textContent = on ? '暫停' : '播放';
    playBtn.setAttribute('aria-pressed', String(on));
    const active = new Set(on ? engine.activeIds : []);
    for (const b of mixer.querySelectorAll('button')) b.setAttribute('aria-pressed', String(active.has(b.dataset.id)));
    for (const v of mixer.querySelectorAll('input')) v.hidden = !active.has(v.dataset.vol);
    const left = Math.max(0, Math.ceil((engine.timerEnd - Date.now()) / 60000));
    status.textContent = on && engine.timerEnd ? `約 ${left} 分鐘後淡出關閉` : '';
  }
  engine.onChange = render;
  setInterval(() => { if (engine.timerEnd) render(); }, 15000);

  async function play(track, opts) {
    try {
      const wasPlaying = engine.playing;
      const r = await engine.play(track, opts);
      if (!r.ok) { toast(r.reason); return; }
      if (!wasPlaying) engine.setTimer(Number(timerSel.value) * 60000);
      persist({ lastTrack: track.id });
    } catch {
      toast('無法播放這個音源，請改選其他音源。');
    }
    render();
  }

  function toggleMix(track, v) {
    if (engine.channels.has(track.id)) engine.stop(track.id);
    else play(track, { replace: false, volume: Number(v.value) });
  }

  function setMixMode(on) {
    engine.stopAll();
    engine.maxChannels = on ? MAX_MIX : 1;
    single.hidden = on;
    mixBox.hidden = !on;
    render();
  }

  playBtn.addEventListener('click', () => (engine.playing ? engine.stopAll() : play(byId.get(trackSel.value))));
  trackSel.addEventListener('change', () => { if (engine.playing) play(byId.get(trackSel.value)); else persist({ lastTrack: trackSel.value }); });
  stopAllBtn.addEventListener('click', () => engine.stopAll());
  vol.addEventListener('input', () => engine.setVolume(Number(vol.value)));
  vol.addEventListener('change', () => persist({ volume: Number(vol.value) }));
  timerSel.addEventListener('change', () => { if (engine.playing) engine.setTimer(Number(timerSel.value) * 60000); render(); });

  // 設定頁的混音開關（預設關閉）
  const mixToggle = document.getElementById('mix-enabled');
  if (mixToggle) {
    mixToggle.checked = !!settings.audio.mixEnabled;
    mixToggle.addEventListener('change', () => { persist({ mixEnabled: mixToggle.checked }); setMixMode(mixToggle.checked); });
  }
  setMixMode(!!settings.audio.mixEnabled);
  fillTracks();

  loadFileTracks().then((files) => {
    if (!files.length) return;
    files.forEach((t) => { tracks.push(t); byId.set(t.id, t); });
    fillTracks();
  });
  return { engine, byId };
}
