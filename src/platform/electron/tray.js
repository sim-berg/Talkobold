// Electron-specific: tray icon + menu.
// Note: GNOME (your desktop) hides legacy trays by default — you may need the
// "AppIndicator and KStatusNotifier Support" extension for the icon to show.
// The app is fully usable via the global hotkey regardless.
const { Tray, Menu } = require('electron');
const { iconImage } = require('./icon');

let tray = null;

function createTray({ onToggle, onQuit }) {
  const image = iconImage();

  try {
    tray = new Tray(image);
  } catch (err) {
    // Some environments can't host a tray at all; that's non-fatal.
    console.warn('Tray unavailable:', err.message);
    return null;
  }

  tray.setToolTip('Talkobold');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show / Hide  (Ctrl+Alt+Space)', click: onToggle },
      { type: 'separator' },
      { label: 'Quit', click: onQuit },
    ])
  );
  tray.on('click', onToggle);
  return tray;
}

module.exports = { createTray };
