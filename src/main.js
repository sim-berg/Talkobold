// Electron entry point. Wires the platform layer (window/hotkey/tray) together
// with the portable core (tts/phrases) over IPC.
//   Phase 1: launch, single-instance, tray, global toggle hotkey.
//   Phase 2: settings store + ElevenLabs TTS (synthesis runs here; playback in
//            the renderer, which owns the DOM audio + setSinkId routing).
//   Phase 3: pw-loopback virtual microphone lifecycle.
//   Phase 4: editable, persisted quick phrases.
const { app, ipcMain, session, shell } = require('electron');
const win = require('./platform/electron/window');
const hotkey = require('./platform/electron/hotkey');
const { createTray } = require('./platform/electron/tray');
const store = require('./platform/electron/store');
const virtualmic = require('./platform/electron/virtualmic');
const { iconDataUrl } = require('./platform/electron/icon');
const tts = require('./core/tts');
const { normalize } = require('./core/phrases');

// --toggle: when a second launch carries this flag, the already-running
// instance toggles the window (used by the Wayland GNOME-shortcut fallback).
function argvWantsToggle(argv) {
  return argv.includes('--toggle');
}

// Reflect the "start when I log in" setting into the OS (Windows/macOS login
// item, or a Linux autostart .desktop entry — all handled by Electron).
function applyAutostart(enabled) {
  try {
    app.setLoginItemSettings({ openAtLogin: !!enabled });
  } catch (err) {
    console.warn('[autostart] could not update login item:', err.message);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Another instance owns the window; we've already handed our argv to it via
  // the 'second-instance' event below. Exit quietly.
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (argvWantsToggle(argv)) {
      win.toggle();
    } else {
      win.show();
    }
  });

  app.whenReady().then(() => {
    // Let the renderer use getUserMedia (to unlock audio device labels) and
    // setSinkId without prompting — this is a single-user local app.
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(true));

    win.createWindow();

    // First launch (or "show on launch" opt-in): make the window visible so the
    // app isn't an invisible no-op. A brand-new install hasn't onboarded yet, so
    // the renderer shows its setup wizard over the (quietly shown) window.
    const startup = store.getAll();
    if (!startup.onboarded) win.showQuiet();
    else if (startup.showOnLaunch) win.show();
    applyAutostart(startup.autostart);

    // Provision the virtual mic up front so "TalkKobold Mic" is selectable in
    // Discord/Zoom as soon as the app is running. Non-fatal if unavailable.
    const vm = virtualmic.start();
    if (!vm.ok) console.warn('[virtualmic]', vm.error);

    const onToggle = () => win.toggle();
    const onQuit = () => {
      global.__talkkobold_quitting = true;
      app.quit();
    };

    const { ok, accelerator } = hotkey.registerToggle(
      hotkey.DEFAULT_ACCELERATOR,
      onToggle
    );
    if (!ok) {
      console.warn(
        `[hotkey] Could not register ${accelerator} globally. ` +
          `On native Wayland, bind a GNOME Custom Shortcut to ` +
          `"npm --prefix ${app.getAppPath()} run toggle" instead.`
      );
    }

    createTray({ onToggle, onQuit });

    // --- IPC: status (hotkey fallback hint) --------------------------------
    ipcMain.handle('get-status', () => ({
      hotkeyOk: ok,
      accelerator,
      appPath: app.getAppPath(),
    }));

    ipcMain.on('hide-window', () => win.hide());
    ipcMain.handle('get-icon', () => iconDataUrl());
    ipcMain.on('open-external', (_e, url) => {
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
    });

    // --- IPC: settings (phase 2-4) -----------------------------------------
    ipcMain.handle('get-settings', () => store.getAll());
    ipcMain.handle('set-settings', (_e, patch) => {
      const next = store.set(patch || {});
      if (patch && 'autostart' in patch) applyAutostart(next.autostart);
      return next;
    });

    // --- IPC: TTS (phase 2) -------------------------------------------------
    // Synthesis runs in main (has fetch + the portable core); the renderer gets
    // raw mp3 bytes and handles playback/routing.
    ipcMain.handle('tts-synthesize', async (_e, { text }) => {
      const s = store.getAll();
      try {
        const buf = await tts.synthesize({
          apiKey: s.apiKey,
          text,
          voiceId: s.voiceId,
          modelId: s.modelId,
        });
        return { ok: true, audio: Buffer.from(buf) };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    });

    ipcMain.handle('list-voices', async () => {
      const s = store.getAll();
      try {
        return { ok: true, voices: await tts.listVoices({ apiKey: s.apiKey }) };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    });

    // --- IPC: virtual mic (phase 3) ----------------------------------------
    ipcMain.handle('virtualmic-status', () => virtualmic.status());
    ipcMain.handle('virtualmic-start', () => {
      virtualmic.start();
      return virtualmic.status();
    });

    // --- IPC: quick phrases (phase 4) --------------------------------------
    // core/phrases.js stays the single source of truth for shape/normalisation.
    ipcMain.handle('get-phrases', () => normalize(store.getAll().phrases));
    ipcMain.handle('set-phrases', (_e, list) => {
      const phrases = normalize(list);
      store.set({ phrases });
      return phrases;
    });

    // If launched with --toggle as the FIRST instance, just show normally.
    if (argvWantsToggle(process.argv)) win.show();
  });

  app.on('will-quit', () => {
    hotkey.unregisterAll();
    virtualmic.stop();
  });

  // Keep running in the tray when the window is closed.
  app.on('window-all-closed', () => {
    // Do nothing: we live in the tray / behind the hotkey.
  });
}
