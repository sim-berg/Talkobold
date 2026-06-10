// Safe IPC bridge between the sandboxed renderer and the main process.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('talk', {
  // main -> renderer: focus the text box (fired when shown via hotkey).
  onFocusInput: (cb) => ipcRenderer.on('focus-input', () => cb()),

  // window / status
  getStatus: () => ipcRenderer.invoke('get-status'),
  hide: () => ipcRenderer.send('hide-window'),
  getIcon: () => ipcRenderer.invoke('get-icon'),
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // settings (phase 2-4)
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (patch) => ipcRenderer.invoke('set-settings', patch),

  // TTS (phase 2). Returns { ok, audio: Uint8Array } | { ok:false, error }.
  synthesize: (text) => ipcRenderer.invoke('tts-synthesize', { text }),
  listVoices: () => ipcRenderer.invoke('list-voices'),

  // virtual mic (phase 3)
  virtualMicStatus: () => ipcRenderer.invoke('virtualmic-status'),
  virtualMicStart: () => ipcRenderer.invoke('virtualmic-start'),

  // quick phrases (phase 4)
  getPhrases: () => ipcRenderer.invoke('get-phrases'),
  setPhrases: (list) => ipcRenderer.invoke('set-phrases', list),
});
