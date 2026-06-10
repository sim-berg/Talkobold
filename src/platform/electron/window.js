// Electron-specific: the mini always-on-top window and its toggle logic.
const path = require('path');
const { BrowserWindow, screen } = require('electron');
const { iconImage } = require('./icon');

let win = null;

function createWindow() {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
  const winW = 400;
  const winH = 420;

  win = new BrowserWindow({
    width: winW,
    height: winH,
    x: Math.round((screenW - winW) / 2),
    y: 60,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    title: 'Talkobold',
    icon: iconImage(),
    backgroundColor: '#1b1b24',
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Float above fullscreen apps (e.g. a fullscreen video call) where allowed.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadFile(path.join(__dirname, '..', '..', 'ui', 'index.html'));

  // Surface renderer warnings/errors in the main log (handy in dev; quiet
  // otherwise — info/log levels are ignored).
  win.webContents.on('console-message', (_e, level, message, line, source) => {
    if (level >= 2) console.log(`[renderer] ${message} (${source}:${line})`);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer] process gone:', details.reason);
  });

  // Hide instead of close when the user dismisses it.
  win.on('close', (e) => {
    if (!global.__talkobold_quitting) {
      e.preventDefault();
      win.hide();
    }
  });

  return win;
}

function getWindow() {
  return win;
}

/** Show + focus the window and ask the renderer to focus the input. */
function show() {
  if (!win) return;
  win.show();
  win.focus();
  win.webContents.send('focus-input');
}

/** Show + focus the window WITHOUT stealing focus into the text box. Used for
 *  the first-launch onboarding wizard, which sits over the input. */
function showQuiet() {
  if (!win) return;
  win.show();
  win.focus();
}

function hide() {
  if (win) win.hide();
}

/**
 * Same-key toggle: if the window is up AND focused, hide it; otherwise bring
 * it forward and focus the text box. This is what the global hotkey calls.
 */
function toggle() {
  if (!win) return;
  if (win.isVisible() && win.isFocused()) {
    hide();
  } else {
    show();
  }
}

module.exports = { createWindow, getWindow, show, showQuiet, hide, toggle };
