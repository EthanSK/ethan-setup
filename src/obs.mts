// Interaction for the standalone OBS recording example. — GPT-6
import { requiredElement } from "./dom.mjs";

const record = requiredElement<HTMLButtonElement>('#record');
const pause = requiredElement<HTMLButtonElement>('#pause');
const badge = requiredElement('.record-badge');
let recording = true, paused = false, elapsed = 0;

function updateRecording() {
  record.setAttribute('aria-pressed', String(recording));
  record.textContent = recording ? 'Stop recording' : 'Start recording';
  pause.disabled = !recording;
  pause.setAttribute('aria-pressed', String(paused));
  pause.textContent = paused ? 'Resume recording' : 'Pause recording';
  requiredElement('#record-status').textContent = !recording ? 'Recording stopped' : paused ? 'Recording paused' : 'Recording example';
  requiredElement('#preview-status').textContent = !recording ? 'STOPPED' : paused ? 'PAUSED' : 'REC';
  badge.classList.toggle('paused', paused); badge.classList.toggle('stopped', !recording);
}
record.addEventListener('click', () => { recording = !recording; paused = false; if (recording) elapsed = 0; updateRecording(); });
pause.addEventListener('click', () => { paused = !paused; updateRecording(); });
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-scene]')) button.addEventListener('click', () => {
  document.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  requiredElement('#scene-image').hidden = button.dataset.scene !== 'room';
  requiredElement('#desktop-preview').hidden = button.dataset.scene !== 'desktop';
});
const sourceToggle = requiredElement<HTMLInputElement>('#source-toggle');
sourceToggle.addEventListener('change', () => {
  requiredElement('#scene-image').style.visibility = sourceToggle.checked ? 'visible' : 'hidden';
  requiredElement('#desktop-preview').style.visibility = sourceToggle.checked ? 'visible' : 'hidden';
});
const mic = requiredElement<HTMLInputElement>('#mic');
mic.addEventListener('input', () => { requiredElement('#mic-level').textContent = `${mic.value} dB`; });
const mute = requiredElement<HTMLButtonElement>('#mute');
mute.addEventListener('click', () => {
  const muted = mute.getAttribute('aria-pressed') !== 'true';
  mute.setAttribute('aria-pressed', String(muted)); mute.textContent = muted ? 'Muted' : 'Mute';
  requiredElement('.meter').style.opacity = muted ? '.4' : '1';
});
setInterval(() => {
  if (!recording || paused || document.hidden) return;
  elapsed++;
  requiredElement('#elapsed').textContent = [Math.floor(elapsed / 3600), Math.floor(elapsed / 60) % 60, elapsed % 60].map(value => String(value).padStart(2,'0')).join(':');
}, 1000); // This isolated demo never requests capture access, opens a socket, or controls the real recording.

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && window.parent !== window) window.parent.postMessage('close-setup-screen', location.origin); // Keyboard events inside this iframe do not bubble to the room dialog.
});
