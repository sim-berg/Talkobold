// Picks the per-OS virtual-microphone implementation. Both expose the same
// interface: start(), stop(), status(), isAvailable(), isRunning().
//   - Linux  → spawns pw-loopback (PipeWire)            [virtualmic.linux.js]
//   - Windows→ detects the user-installed VB-CABLE      [virtualmic.win.js]
//   - macOS  → falls back to the Linux probe (no pw-loopback ⇒ unavailable);
//              BlackHole support lands with the macOS build.
module.exports =
  process.platform === 'win32'
    ? require('./virtualmic.win')
    : require('./virtualmic.linux');
