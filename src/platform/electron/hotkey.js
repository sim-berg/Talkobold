// Electron-specific: global hotkey registration.
//
// On X11 / XWayland (Electron's default backend) globalShortcut works. On a
// locked-down native-Wayland session it may silently fail to register — in
// that case we fall back to a GNOME Custom Shortcut bound to
// `talkkobold --toggle`, which reaches the running instance via the
// single-instance lock (see main.js). registerToggle() reports whether the
// in-app shortcut took, so the UI can tell the user to set up the fallback.
const { globalShortcut } = require('electron');

const DEFAULT_ACCELERATOR = 'Control+Alt+Space';

/**
 * @param {string} accelerator
 * @param {() => void} onToggle
 * @returns {{ ok: boolean, accelerator: string }}
 */
function registerToggle(accelerator, onToggle) {
  const acc = accelerator || DEFAULT_ACCELERATOR;
  let ok = false;
  try {
    ok = globalShortcut.register(acc, onToggle);
  } catch (err) {
    ok = false;
  }
  // register() can return false (already taken / unsupported) without throwing.
  if (!ok) ok = globalShortcut.isRegistered(acc);
  return { ok, accelerator: acc };
}

function unregisterAll() {
  globalShortcut.unregisterAll();
}

module.exports = { registerToggle, unregisterAll, DEFAULT_ACCELERATOR };
