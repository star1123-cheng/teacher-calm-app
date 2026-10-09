// 白噪音介面：選擇音源、播放暫停、音量、定時關閉
import { AudioEngine, SYNTH_TRACKS, TIMER_OPTIONS, loadFileTracks } from './audio.js';
import { getSettings, saveSettings } from './storage.js';
import { el, toast } from './ui.js';

export const engine = new AudioEngine();

export function initAudio(root = document.getElementById('audio')) {
  const settings = getSettings();
  engine.volume = settings.audio.volume;
  // 先顯示合成噪音，音檔清單檢查完再補上，避免拖慢首頁
  const byId = new Map(SYNTH_TRACKS.map((t) => [t.id, t]));

  const trackSel = el('select', { id: 'audio-track' },
    el('optgroup', { label: '合成' }, SYNTH_TRACKS.map((t) => el('option', { value: t.id, text: t.name }))),
  );
  if (byId.has(settings.audio.lastTrack)) trackSel.value = settings.audio.lastTrack;
  loadFileTracks().then((fileTracks) => {
    if (!fileTracks.length) return;
    fileTracks.forEach((t) => byId.set(t.id, t));
    trackSel.append(el('optgroup', { label: '音檔' }, fileTracks.map((t) => el('option', { value: t.id, text: t.name }))));
    if (!engine.playing && byId.has(settings.audio.lastTrack)) trackSel.value = settings.audio.lastTrack;
  });
  const playBtn = el('button', { type: 'button', text: '播放', 'aria-pressed': 'false' });
  const vol = el('input', { type: 'range', id: 'audio-vol', min: '0', max: '1', step: '0.05' });
  vol.value = String(engine.volume);
  const timerSel = el('select', { id: 'audio-timer' },
    TIMER_OPTIONS.map((m) => el('option', { value: String(m), text: m ? `${m} 分鐘後關閉` : '不定時' })));
  const status = el('p', { class: 'muted', 'aria-live': 'polite' });

  root.append(
    el('p', {}, el('label', { for: 'audio-track', text: '音源' }), ' ', trackSel, ' ', playBtn),
    el('p', {}, el('label', { for: 'audio-vol', text: '音量' }), ' ', vol),
    el('p', {}, el('label', { for: 'audio-timer', text: '定時' }), ' ', timerSel),
    status,
  );

  const persist = (patch) => {
    const s = getSettings();
    s.audio = { ...s.audio, ...patch };
    saveSettings(s);
  };

  function render() {
    const on = engine.playing;
    playBtn.textContent = on ? '暫停' : '播放';
    playBtn.setAttribute('aria-pressed', String(on));
    const left = Math.max(0, Math.ceil((engine.timerEnd - Date.now()) / 60000));
    status.textContent = on && engine.timerEnd ? `約 ${left} 分鐘後淡出關閉` : '';
  }
  engine.onChange = render;
  setInterval(() => { if (engine.timerEnd) render(); }, 15000);

  async function start() {
    const track = byId.get(trackSel.value);
    try {
      await engine.play(track);
      engine.setTimer(Number(timerSel.value) * 60000);
      persist({ lastTrack: track.id });
    } catch {
      toast('無法播放這個音源，請改選其他音源。');
    }
    render();
  }

  playBtn.addEventListener('click', () => (engine.playing ? engine.stopAll() : start()));
  trackSel.addEventListener('change', () => { if (engine.playing) start(); else persist({ lastTrack: trackSel.value }); });
  vol.addEventListener('input', () => engine.setVolume(Number(vol.value)));
  vol.addEventListener('change', () => persist({ volume: Number(vol.value) }));
  timerSel.addEventListener('change', () => { if (engine.playing) engine.setTimer(Number(timerSel.value) * 60000); render(); });
  render();
  return { engine, byId };
}
