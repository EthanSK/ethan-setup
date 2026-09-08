const record = document.querySelector('#record');
const pause = document.querySelector('#pause');
const badge = document.querySelector('.record-badge');
let recording = true, paused = false, elapsed = 0;

function updateRecording() {
  record.setAttribute('aria-pressed', String(recording));
  record.textContent = recording ? 'Stop recording' : 'Start recording';
  pause.disabled = !recording;
  pause.setAttribute('aria-pressed', String(paused));
  pause.textContent = paused ? 'Resume recording' : 'Pause recording';
  document.querySelector('#record-status').textContent = !recording ? 'Recording stopped' : paused ? 'Recording paused' : 'Recording example';
  document.querySelector('#preview-status').textContent = !recording ? 'STOPPED' : paused ? 'PAUSED' : 'REC';
  badge.classList.toggle('paused', paused); badge.classList.toggle('stopped', !recording);
}
record.addEventListener('click', () => { recording = !recording; paused = false; if (recording) elapsed = 0; updateRecording(); });
pause.addEventListener('click', () => { paused = !paused; updateRecording(); });
for (const button of document.querySelectorAll('[data-scene]')) button.addEventListener('click', () => {
  document.querySelectorAll('[data-scene]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  document.querySelector('#scene-image').hidden = button.dataset.scene !== 'room';
  document.querySelector('#desktop-preview').hidden = button.dataset.scene !== 'desktop';
});
document.querySelector('#source-toggle').addEventListener('change', event => {
  document.querySelector('#scene-image').style.visibility = event.target.checked ? 'visible' : 'hidden';
  document.querySelector('#desktop-preview').style.visibility = event.target.checked ? 'visible' : 'hidden';
});
document.querySelector('#mic').addEventListener('input', event => { document.querySelector('#mic-level').textContent = `${event.target.value} dB`; });
document.querySelector('#mute').addEventListener('click', event => {
  const muted = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  event.currentTarget.setAttribute('aria-pressed', String(muted)); event.currentTarget.textContent = muted ? 'Muted' : 'Mute';
  document.querySelector('.meter').style.opacity = muted ? '.4' : '1';
});
setInterval(() => {
  if (!recording || paused || document.hidden) return;
  elapsed++;
  document.querySelector('#elapsed').textContent = [Math.floor(elapsed / 3600), Math.floor(elapsed / 60) % 60, elapsed % 60].map(value => String(value).padStart(2,'0')).join(':');
}, 1000); // This isolated demo never requests capture access, opens a socket, or controls the real recording.

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && window.parent !== window) window.parent.postMessage('close-setup-screen', location.origin); // Keyboard events inside this iframe do not bubble to the room dialog.
});
