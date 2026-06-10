// Renderer (runs sandboxed). Talks to main only through window.talk (preload).
//
//   Phase 2: settings (API key / voice / model), Speak -> main synthesises with
//            ElevenLabs, we play the mp3 here. Playback + device routing live in
//            the renderer because setSinkId() is a DOM API.
//   Phase 3: two audio elements — one targets the virtual sink (what friends
//            hear via "Talkobold Mic"), one is the monitor (what YOU hear, with
//            its own volume + mute).
//   Phase 4: quick phrases are served from core/phrases.js over IPC, editable
//            and persisted.

const $ = (id) => document.getElementById(id);

// --- elements --------------------------------------------------------------
const textEl = $('text');
const speakBtn = $('speakBtn');
const phrasesEl = $('phrases');
const editPhrasesBtn = $('editPhrasesBtn');
const closeBtn = $('closeBtn');
const hotkeyStatus = $('hotkeyStatus');
const statusMsg = $('statusMsg');
const settingsBtn = $('settingsBtn');
const settingsPanel = $('settings');
const settingsCloseBtn = $('settingsCloseBtn');
// settings fields
const apiKeyEl = $('apiKey');
const voiceSelect = $('voiceSelect');
const refreshVoicesBtn = $('refreshVoices');
const voiceIdManual = $('voiceIdManual');
const modelSelect = $('modelSelect');
const vmStatusEl = $('vmStatus');
const vmActions = $('vmActions');
const vmInstall = $('vmInstall');
const vmRecheck = $('vmRecheck');
const vmDevice = $('vmDevice');
const monEnabled = $('monEnabled');
const monDevice = $('monDevice');
// inline monitor controls
const monitorBox = $('monitor');
const muteBtn = $('muteBtn');
const monVol = $('monVol');
// settings: window section
const showOnLaunch = $('showOnLaunch');
const autostartEl = $('autostart');
const replayWizardBtn = $('replayWizard');
// onboarding wizard
const wizard = $('wizard');
const wzLogo = $('wzLogo');
const wzBack = $('wzBack');
const wzNext = $('wzNext');
const wzDots = $('wzDots');
const wzKey = $('wzKey');
const wzVoice = $('wzVoice');
const wzLoadVoices = $('wzLoadVoices');
const wzVmStatus = $('wzVmStatus');
const wzVmHelp = $('wzVmHelp');
const wzVmActions = $('wzVmActions');
const wzVmInstall = $('wzVmInstall');
const wzVmRecheck = $('wzVmRecheck');
const wzMonitor = $('wzMonitor');
const wzShowOnLaunch = $('wzShowOnLaunch');

// --- state -----------------------------------------------------------------
let settings = null;
let phrases = [];
let editing = false;
// Virtual-mic info from main (platform, sink label hint, mic label, install URL)
// and whether the matching output device is currently present.
let vmInfo = null;
let vmFound = false;
function sinkHint() { return (vmInfo && vmInfo.sinkHint) || 'Talkobold-sink'; }

// Two independent playback sinks (see header).
const aMic = new Audio();
const aMon = new Audio();
aMic.preload = 'auto';
aMon.preload = 'auto';

// --- status line -----------------------------------------------------------
let statusTimer = null;
function setStatus(msg, isError = false) {
  statusMsg.textContent = msg || '';
  statusMsg.classList.toggle('err', !!isError);
  clearTimeout(statusTimer);
  if (msg && !isError) {
    statusTimer = setTimeout(() => {
      statusMsg.textContent = '';
      statusMsg.classList.remove('err');
    }, 4000);
  }
}

// --- speaking (phase 2-3) --------------------------------------------------
async function speak(textArg) {
  const text = (textArg ?? textEl.value).trim();
  if (!text) return;
  if (!settings.apiKey) return openSettings('Add your ElevenLabs API key first.');
  if (!settings.voiceId) return openSettings('Choose a voice first.');

  speakBtn.disabled = true;
  const original = speakBtn.textContent;
  speakBtn.textContent = 'Speaking…';
  setStatus('Synthesising…');

  try {
    const res = await window.talk.synthesize(text);
    if (!res.ok) throw new Error(res.error || 'TTS failed');
    await playBytes(res.audio);
    setStatus('Spoke.');
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    speakBtn.textContent = original;
    speakBtn.disabled = false;
  }
}

// Play the mp3 bytes to the virtual mic and (if enabled) the monitor.
async function playBytes(bytes) {
  const blob = new Blob([bytes], { type: 'audio/mpeg' });

  const tasks = [];

  // 1) virtual mic — what friends hear. Skip if no virtual sink is selected.
  if (settings.virtualMicDeviceId) {
    tasks.push(playOn(aMic, blob, settings.virtualMicDeviceId, 1));
  }

  // 2) monitor — what YOU hear (sidetone), with volume + mute.
  if (settings.monitorEnabled && !settings.monitorMuted && settings.monitorVolume > 0) {
    tasks.push(
      playOn(aMon, blob, settings.monitorDeviceId || 'default', settings.monitorVolume)
    );
  }

  // Fallback: nothing audible would play (no virtual mic, monitor off) — still
  // play once on the default output so the user gets feedback.
  if (tasks.length === 0) tasks.push(playOn(aMon, blob, 'default', settings.monitorVolume || 0.6));

  await Promise.allSettled(tasks);
}

async function playOn(el, blob, sinkId, volume) {
  const url = URL.createObjectURL(blob);
  try {
    if (sinkId && el.setSinkId) {
      try { await el.setSinkId(sinkId); } catch { /* device gone; use default */ }
    }
    el.volume = Math.max(0, Math.min(1, volume));
    el.src = url;
    await el.play();
    await new Promise((resolve) => {
      el.onended = resolve;
      el.onerror = resolve;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// --- quick phrases (phase 4) -----------------------------------------------
function renderPhrases() {
  phrasesEl.innerHTML = '';
  if (editing) {
    phrases.forEach((phrase, i) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      const input = document.createElement('input');
      input.value = phrase;
      input.addEventListener('input', () => { phrases[i] = input.value; });
      input.addEventListener('blur', savePhrases);
      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '×';
      del.title = 'Remove';
      del.addEventListener('click', () => {
        phrases.splice(i, 1);
        savePhrases();
        renderPhrases();
      });
      chip.append(input, del);
      phrasesEl.appendChild(chip);
    });
    const add = document.createElement('button');
    add.className = 'addchip';
    add.textContent = '+ add phrase';
    add.addEventListener('click', () => {
      phrases.push('New phrase');
      savePhrases();
      renderPhrases();
      const inputs = phrasesEl.querySelectorAll('.chip input');
      const last = inputs[inputs.length - 1];
      if (last) { last.focus(); last.select(); }
    });
    phrasesEl.appendChild(add);
  } else {
    for (const phrase of phrases) {
      const b = document.createElement('button');
      b.className = 'phrase';
      b.textContent = phrase;
      b.title = phrase;
      b.addEventListener('click', () => { textEl.value = phrase; speak(phrase); });
      phrasesEl.appendChild(b);
    }
  }
}

async function savePhrases() {
  phrases = await window.talk.setPhrases(phrases); // main normalises
}

editPhrasesBtn.addEventListener('click', async () => {
  editing = !editing;
  if (!editing) await savePhrases();
  editPhrasesBtn.textContent = editing ? 'done' : 'edit';
  editPhrasesBtn.classList.toggle('active', editing);
  renderPhrases();
});

// --- settings persistence helpers ------------------------------------------
async function patch(p) {
  settings = await window.talk.setSettings(p);
}

// --- settings panel --------------------------------------------------------
function openSettings(hint) {
  settingsPanel.classList.add('show');
  if (hint) setStatus(hint, true);
  apiKeyEl.focus();
}
function closeSettings() { settingsPanel.classList.remove('show'); }

settingsBtn.addEventListener('click', () =>
  settingsPanel.classList.contains('show') ? closeSettings() : openSettings()
);
settingsCloseBtn.addEventListener('click', closeSettings);

apiKeyEl.addEventListener('change', () => patch({ apiKey: apiKeyEl.value.trim() }));
modelSelect.addEventListener('change', () => patch({ modelId: modelSelect.value }));

voiceSelect.addEventListener('change', () => {
  const opt = voiceSelect.selectedOptions[0];
  if (!opt || !opt.value) return;
  voiceIdManual.value = opt.value;
  patch({ voiceId: opt.value, voiceName: opt.textContent });
});
voiceIdManual.addEventListener('change', () => {
  const id = voiceIdManual.value.trim();
  patch({ voiceId: id, voiceName: id ? '(manual)' : '' });
});

refreshVoicesBtn.addEventListener('click', async () => {
  refreshVoicesBtn.disabled = true;
  try {
    await loadVoicesWithKey(apiKeyEl.value.trim());
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    refreshVoicesBtn.disabled = false;
  }
});

// Fill every voice <select> (settings + wizard share one voice list).
function populateVoices(voices) {
  for (const sel of [voiceSelect, wzVoice]) {
    sel.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— select a voice —';
    sel.appendChild(blank);
    for (const v of voices) {
      const o = document.createElement('option');
      o.value = v.voiceId;
      o.textContent = v.name;
      sel.appendChild(o);
    }
    if (settings.voiceId) sel.value = settings.voiceId;
  }
}

// Shared "load voices for this key" used by both Refresh buttons.
async function loadVoicesWithKey(key, statusFn = setStatus) {
  if (key) await patch({ apiKey: key });
  statusFn('Loading voices…');
  const res = await window.talk.listVoices();
  if (!res.ok) throw new Error(res.error || 'Could not load voices');
  populateVoices(res.voices);
  statusFn(`Loaded ${res.voices.length} voices.`);
}

// monitor enable / device
monEnabled.addEventListener('change', () => {
  patch({ monitorEnabled: monEnabled.checked });
  reflectMonitor();
});
monDevice.addEventListener('change', () => patch({ monitorDeviceId: monDevice.value }));
vmDevice.addEventListener('change', () => patch({ virtualMicDeviceId: vmDevice.value }));

// inline monitor controls (main window)
muteBtn.addEventListener('click', () => {
  patch({ monitorMuted: !settings.monitorMuted });
  reflectMonitor();
});
monVol.addEventListener('input', () => {
  settings.monitorVolume = monVol.value / 100;
});
monVol.addEventListener('change', () => patch({ monitorVolume: monVol.value / 100 }));

function reflectMonitor() {
  const active = settings.monitorEnabled && !settings.monitorMuted;
  monitorBox.classList.toggle('off', !active);
  muteBtn.textContent = settings.monitorMuted || !settings.monitorEnabled ? '🔇' : '🔊';
  monVol.value = Math.round((settings.monitorVolume ?? 0.6) * 100);
  monEnabled.checked = !!settings.monitorEnabled;
}

// settings: window section
showOnLaunch.addEventListener('change', () => patch({ showOnLaunch: showOnLaunch.checked }));
autostartEl.addEventListener('change', () => patch({ autostart: autostartEl.checked }));
replayWizardBtn.addEventListener('click', () => { closeSettings(); openWizard(); });

// --- onboarding wizard (phase 2-3 first-run) -------------------------------
const WZ_STEPS = 4;
let wzStep = 1;

function openWizard() {
  wzStep = 1;
  wzKey.value = settings.apiKey || '';
  wzMonitor.checked = settings.monitorEnabled !== false;
  wzShowOnLaunch.checked = settings.onboarded ? !!settings.showOnLaunch : true;
  renderWzDots();
  showWzStep(1);
  renderVmEverywhere();
  wizard.classList.add('show');
}

function closeWizard() { wizard.classList.remove('show'); }

function renderWzDots() {
  wzDots.innerHTML = '';
  for (let i = 1; i <= WZ_STEPS; i++) {
    const d = document.createElement('i');
    if (i === wzStep) d.className = 'on';
    wzDots.appendChild(d);
  }
}

function showWzStep(n) {
  wzStep = Math.max(1, Math.min(WZ_STEPS, n));
  for (const sec of wizard.querySelectorAll('.step')) {
    sec.hidden = Number(sec.dataset.step) !== wzStep;
  }
  wzBack.disabled = wzStep === 1;
  wzNext.textContent = wzStep === WZ_STEPS ? 'Finish' : 'Next';
  renderWzDots();
  if (wzStep === 3) recheckVm(); // re-scan in case VB-CABLE was just installed
}

wzBack.addEventListener('click', () => showWzStep(wzStep - 1));
wzNext.addEventListener('click', async () => {
  if (wzStep < WZ_STEPS) return showWzStep(wzStep + 1);
  // finish
  await patch({
    onboarded: true,
    showOnLaunch: wzShowOnLaunch.checked,
    monitorEnabled: wzMonitor.checked,
  });
  // mirror into the main UI controls
  apiKeyEl.value = settings.apiKey || '';
  showOnLaunch.checked = !!settings.showOnLaunch;
  reflectMonitor();
  closeWizard();
  textEl.focus();
});

wzKey.addEventListener('change', () => patch({ apiKey: wzKey.value.trim() }));
wzLoadVoices.addEventListener('click', async () => {
  wzLoadVoices.disabled = true;
  try {
    await loadVoicesWithKey(wzKey.value.trim(), setStatus);
    apiKeyEl.value = settings.apiKey || '';
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    wzLoadVoices.disabled = false;
  }
});
wzVoice.addEventListener('change', () => {
  const opt = wzVoice.selectedOptions[0];
  if (!opt || !opt.value) return;
  voiceIdManual.value = opt.value;
  if (settings.voiceId) voiceSelect.value = opt.value;
  patch({ voiceId: opt.value, voiceName: opt.textContent });
});

// --- audio devices ---------------------------------------------------------
async function loadDevices() {
  // getUserMedia unlocks output-device labels in Chromium; harmless if it
  // fails (no mic) — we just won't have nice labels to match against.
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
  } catch { /* no mic / denied — labels may be blank */ }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const outs = devices.filter((d) => d.kind === 'audiooutput');

  // virtual sink dropdown
  fillSelect(vmDevice, outs, settings.virtualMicDeviceId, '— none (no virtual mic) —', '');
  // monitor output dropdown (always offer the system default)
  fillSelect(monDevice, outs, settings.monitorDeviceId, 'System default', 'default');

  // is the virtual sink (Talkobold-sink / "CABLE Input") present at all?
  const hint = sinkHint();
  vmFound = outs.some((d) => (d.label || '').includes(hint));

  // auto-detect + select the virtual sink by label if the user hasn't chosen
  // one that still exists.
  const stillValid = settings.virtualMicDeviceId &&
    outs.some((d) => d.deviceId === settings.virtualMicDeviceId);
  if (!stillValid) {
    const sink = outs.find((d) => (d.label || '').includes(hint));
    if (sink) {
      vmDevice.value = sink.deviceId;
      await patch({ virtualMicDeviceId: sink.deviceId });
    }
  }
}

function fillSelect(sel, outs, current, blankLabel, blankValue) {
  sel.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = blankValue;
  blank.textContent = blankLabel;
  sel.appendChild(blank);
  for (const d of outs) {
    const o = document.createElement('option');
    o.value = d.deviceId;
    o.textContent = d.label || `Output ${d.deviceId.slice(0, 6)}`;
    sel.appendChild(o);
  }
  sel.value = current ?? blankValue;
  if (sel.value !== (current ?? blankValue)) sel.value = blankValue;
}

async function refreshVmInfo() {
  vmInfo = await window.talk.virtualMicStatus();
}

// One renderer for both the settings line and the wizard line. `vmFound` (set
// by loadDevices from enumerateDevices) is the canonical "device present" signal.
function renderVmStatus(target) {
  if (!vmInfo) { target.innerHTML = '…'; return; }
  if (vmInfo.platform === 'win32') {
    target.innerHTML = (vmFound || vmInfo.available)
      ? `<span class="dot ok"></span>VB-CABLE found — pick "${vmInfo.micLabel}" as your mic`
      : `<span class="dot warn"></span>VB-CABLE not installed yet`;
    return;
  }
  // Linux (managed pw-loopback)
  if (!vmInfo.available) {
    target.innerHTML = `<span class="dot warn"></span>pw-loopback not found — virtual mic unavailable`;
  } else if (vmInfo.running) {
    target.innerHTML = `<span class="dot ok"></span>running — pick "${vmInfo.micLabel}" as your mic in Discord/Zoom`;
  } else {
    target.innerHTML = `<span class="dot warn"></span>not running`;
  }
}

// Update vm status + install/recheck affordances in settings AND the wizard.
function renderVmEverywhere() {
  renderVmStatus(vmStatusEl);
  renderVmStatus(wzVmStatus);

  const isWin = !!vmInfo && vmInfo.platform === 'win32';
  const present = vmFound || (vmInfo && vmInfo.available);
  vmActions.style.display = isWin ? 'flex' : 'none';
  wzVmActions.style.display = isWin ? 'flex' : 'none';
  const showInstall = isWin && !present;
  vmInstall.style.display = showInstall ? '' : 'none';
  wzVmInstall.style.display = showInstall ? '' : 'none';

  // Wizard help text (longer instructions).
  if (isWin) {
    wzVmHelp.innerHTML = present
      ? `Open your call app's audio settings and pick <b>"${vmInfo.micLabel}"</b> as the input device.`
      : `Talkobold needs <b>VB-CABLE</b> — a free virtual audio device. Click
         <b>Install VB-CABLE</b>, run its installer (reboot if it asks), then <b>Re-check</b>.`;
  } else {
    wzVmHelp.innerHTML = `Open your call app's audio settings (Discord, Zoom, a game…)
      and pick <b>"${vmInfo ? vmInfo.micLabel : 'Talkobold Mic'}"</b> as the input device.
      It stays available while Talkobold is running.`;
  }
}

// Re-scan devices + status (after the user installs VB-CABLE, or on demand).
async function recheckVm() {
  await refreshVmInfo();
  await loadDevices();
  renderVmEverywhere();
}

function installVm() {
  if (vmInfo && vmInfo.downloadUrl) window.talk.openExternal(vmInfo.downloadUrl);
}
vmInstall.addEventListener('click', installVm);
wzVmInstall.addEventListener('click', installVm);
vmRecheck.addEventListener('click', recheckVm);
wzVmRecheck.addEventListener('click', recheckVm);

// --- window events ---------------------------------------------------------
speakBtn.addEventListener('click', () => speak());
textEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); speak(); }
  else if (e.key === 'Escape') {
    if (wizard.classList.contains('show')) return; // stay in onboarding
    if (settingsPanel.classList.contains('show')) closeSettings();
    else window.talk.hide();
  }
});
closeBtn.addEventListener('click', () => window.talk.hide());
window.talk.onFocusInput(() => { textEl.focus(); textEl.select(); });

// --- status ----------------------------------------------------------------
async function initHotkeyStatus() {
  try {
    const s = await window.talk.getStatus();
    hotkeyStatus.innerHTML = s.hotkeyOk
      ? `<span class="dot ok"></span>hotkey ${s.accelerator}`
      : `<span class="dot warn"></span>hotkey unavailable — see NEXT-STEPS.md`;
  } catch {
    hotkeyStatus.innerHTML = `<span class="dot warn"></span>status unavailable`;
  }
}

// --- boot ------------------------------------------------------------------
async function init() {
  settings = await window.talk.getSettings();
  phrases = await window.talk.getPhrases();

  apiKeyEl.value = settings.apiKey || '';
  modelSelect.value = settings.modelId || 'eleven_flash_v2_5';
  voiceIdManual.value = settings.voiceId || '';
  showOnLaunch.checked = !!settings.showOnLaunch;
  autostartEl.checked = !!settings.autostart;
  if (settings.voiceId) {
    const o = document.createElement('option');
    o.value = settings.voiceId;
    o.textContent = settings.voiceName || settings.voiceId;
    o.selected = true;
    voiceSelect.appendChild(o);
  }

  // wizard logo (user icon or generated fallback, as a data URL)
  try {
    const icon = await window.talk.getIcon();
    if (icon) { wzLogo.src = icon; wzLogo.hidden = false; }
  } catch { /* no icon — leave hidden */ }

  reflectMonitor();
  renderPhrases();
  initHotkeyStatus();
  await refreshVmInfo();   // gets platform + sink hint (needed by loadDevices)
  await loadDevices();     // sets vmFound by scanning enumerated devices
  renderVmEverywhere();

  // First run → onboarding wizard (main has already shown the window).
  if (!settings.onboarded) openWizard();
  else textEl.focus();
}

init();
