// Electron-specific: tiny JSON settings store in the app's userData dir.
// One file, synchronous reads/writes (the payload is a handful of fields).
// In the Tauri port this is replaced by the Rust side's own config storage;
// the shape it returns is what the rest of the app depends on, not this impl.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { defaultTargets } = require('../../core/audio');
const { DEFAULT_PHRASES } = require('../../core/phrases');

const FILE = () => path.join(app.getPath('userData'), 'settings.json');

// Full default settings. `apiKey`/`voiceId` are empty until the user fills them
// in via the settings panel (phase 2).
function defaults() {
  const t = defaultTargets();
  return {
    apiKey: '',
    voiceId: '',
    voiceName: '',
    modelId: 'eleven_flash_v2_5',
    // routing (phase 3)
    virtualMicDeviceId: t.virtualMicDeviceId,
    monitorEnabled: true,
    monitorDeviceId: t.monitorDeviceId,
    monitorVolume: t.monitorVolume,
    monitorMuted: t.monitorMuted,
    // quick phrases (phase 4)
    phrases: [...DEFAULT_PHRASES],
    // first-run + window behaviour
    onboarded: false,
    showOnLaunch: false,
    autostart: false, // start the app at login (OS login item)
  };
}

let cache = null;

function load() {
  if (cache) return cache;
  let stored = {};
  try {
    stored = JSON.parse(fs.readFileSync(FILE(), 'utf8'));
  } catch {
    stored = {};
  }
  cache = { ...defaults(), ...stored };
  return cache;
}

function getAll() {
  return { ...load() };
}

/** Merge a partial patch into settings and persist. Returns the new full set. */
function set(patch) {
  const next = { ...load(), ...patch };
  cache = next;
  try {
    fs.mkdirSync(path.dirname(FILE()), { recursive: true });
    fs.writeFileSync(FILE(), JSON.stringify(next, null, 2));
  } catch (err) {
    console.error('[store] failed to persist settings:', err.message);
  }
  return { ...next };
}

module.exports = { getAll, set, defaults };
