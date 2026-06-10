// Electron-specific (Linux/PipeWire): the virtual microphone provisioning.
//
// We spawn one `pw-loopback` process that exposes TWO PipeWire nodes:
//   - an Audio/Sink  named  TalkKobold-sink  → apps (and our renderer) PLAY into it
//   - an Audio/Source named  talkkobold-mic   → Discord/Zoom/… pick it as a MIC
// pw-loopback wires the sink's captured audio straight to the source, so
// anything played to TalkKobold-sink comes out of "TalkKobold Mic". Killing the
// process removes both nodes, so cleanup is automatic on quit.
//
// Windows/macOS provision their virtual device differently (VB-Cable /
// BlackHole, installed once by the user); this module is the Linux path only.
const { spawn, spawnSync } = require('child_process');
const {
  VIRTUAL_SINK_NODE,
  VIRTUAL_SOURCE_NODE,
  VIRTUAL_MIC_LABEL,
} = require('../../core/audio');

// Description shown to the renderer's enumerateDevices() for the play target.
// Kept equal to the node name so the renderer can match it by label.
const SINK_DESCRIPTION = VIRTUAL_SINK_NODE;

let child = null;

/** Is `pw-loopback` present on this machine? */
function isAvailable() {
  const r = spawnSync('pw-loopback', ['--help'], { stdio: 'ignore' });
  return !r.error;
}

function isRunning() {
  return !!child && child.exitCode === null;
}

/**
 * Spawn pw-loopback (idempotent). Returns { ok, running, error }.
 */
function start() {
  if (isRunning()) return { ok: true, running: true };
  if (!isAvailable()) {
    return {
      ok: false,
      running: false,
      error: 'pw-loopback not found (install PipeWire utilities).',
    };
  }

  // Property *values* are parsed as SPA-JSON, so any value containing a space
  // (e.g. "TalkKobold Mic") must be wrapped in double quotes inside the string.
  const args = [
    '-m',
    '[ FL FR ]',
    '--capture-props=' +
      [
        'media.class=Audio/Sink',
        `node.name=${VIRTUAL_SINK_NODE}`,
        `node.description="${SINK_DESCRIPTION}"`,
      ].join(' '),
    '--playback-props=' +
      [
        'media.class=Audio/Source',
        `node.name=${VIRTUAL_SOURCE_NODE}`,
        `node.description="${VIRTUAL_MIC_LABEL}"`,
      ].join(' '),
  ];

  try {
    child = spawn('pw-loopback', args, { stdio: 'ignore' });
  } catch (err) {
    child = null;
    return { ok: false, running: false, error: err.message };
  }

  child.on('exit', (code, signal) => {
    if (code && code !== 0) {
      console.warn(`[virtualmic] pw-loopback exited code=${code} signal=${signal}`);
    }
    child = null;
  });
  child.on('error', (err) => {
    console.error('[virtualmic] pw-loopback error:', err.message);
    child = null;
  });

  return { ok: true, running: true };
}

function stop() {
  if (child && child.exitCode === null) {
    try {
      child.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
  child = null;
}

function status() {
  return {
    platform: 'linux',
    managed: true, // the app provisions the device by spawning pw-loopback
    supported: true,
    available: isAvailable(),
    running: isRunning(),
    // label substring the renderer matches to find the output device to play
    // into; and the source name apps pick as a microphone.
    sinkHint: SINK_DESCRIPTION,
    micLabel: VIRTUAL_MIC_LABEL,
    downloadUrl: null, // nothing to install on Linux
  };
}

module.exports = { start, stop, status, isAvailable, isRunning };
