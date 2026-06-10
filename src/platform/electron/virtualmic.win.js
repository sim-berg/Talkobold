// Electron-specific (Windows): the virtual microphone is provided by VB-CABLE
// (VB-Audio Virtual Cable), a free virtual-audio driver the user installs once.
// Unlike Linux there is no process to spawn — the OS owns the device. We just
// report whether it's present so the UI can guide the one-time install, and
// hand the renderer the labels it routes audio to:
//   - play target (sink):  "CABLE Input (VB-Audio Virtual Cable)"   ← we play here
//   - microphone (source): "CABLE Output (VB-Audio Virtual Cable)"  ← apps pick this
//
// Authoritative "is it installed?" detection happens in the renderer via
// enumerateDevices() (it already lists audio endpoints by label); the
// PowerShell probe here is a best-effort fallback for the main process.
const { execFile } = require('child_process');

const SINK_HINT = 'CABLE Input'; // substring match on the output device label
const MIC_LABEL = 'CABLE Output (VB-Audio Virtual Cable)';
const DOWNLOAD_URL = 'https://vb-audio.com/Cable/';

// No-ops: the driver is installed system-wide, not spawned/owned by us.
function start() {
  return { ok: true, running: null };
}
function stop() {}
function isRunning() {
  return null; // not applicable — passive driver
}

/** Best-effort probe via PowerShell; the renderer's device scan is canonical. */
function probeInstalled() {
  return new Promise((resolve) => {
    execFile(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "@(Get-CimInstance Win32_SoundDevice | " +
          "Where-Object { $_.Name -match 'CABLE|VB-Audio' }).Count",
      ],
      { timeout: 4000, windowsHide: true },
      (err, stdout) => {
        if (err) return resolve(null); // unknown — let the renderer decide
        resolve(parseInt(String(stdout).trim(), 10) > 0);
      }
    );
  });
}

function isAvailable() {
  return probeInstalled();
}

async function status() {
  return {
    platform: 'win32',
    managed: false, // an external driver the user installs; we don't spawn it
    supported: true,
    available: await probeInstalled(), // may be null if the probe is inconclusive
    running: null,
    sinkHint: SINK_HINT,
    micLabel: MIC_LABEL,
    downloadUrl: DOWNLOAD_URL,
  };
}

module.exports = { start, stop, status, isAvailable, isRunning };
