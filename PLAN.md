# TalkKobold — Plan

**Type text, hear it spoken into a virtual microphone.** Voice for people who
can't talk — so they can join voice chats (Discord, Zoom, WhatsApp calls, games)
and be heard, and also hear their own voice as they "speak."

---

## Goals & decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Framework (now) | **Electron** (all-JS) | Fast to ship; Chromium's `setSinkId()` makes audio routing trivial; simple `npm install`. |
| Framework (later) | **Tauri v2** | Tiny installers, OS-agnostic, mobile-capable. Port when the design is proven. |
| Speech | **ElevenLabs** TTS, `eleven_flash_v2_5` model | Low latency for near-real-time conversation. |
| Hear-your-own-voice | **Monitor playback** to real output, separate volume + mute | Requested feature; second playback target alongside the virtual mic. |
| Trigger | Mini always-on-top window **+ global hotkey toggle** | Same key summons/focuses and dismisses the window. |
| Platform target | Desktop first (Linux → Win/macOS), **mobile later** | See "Mobile reality" below. |

## How the virtual microphone works

The app never touches your real mic. It creates a **virtual audio device** and
plays speech into it; voice-chat apps select that device as their "microphone."

```
 [hotkey] ─toggle─▶ Electron window ─type/tap─▶ ElevenLabs TTS ─▶ audio
                                                                    │
                          ┌─────────────────────────────────────────┤
                          ▼ (setSinkId: virtual mic)                 ▼ (setSinkId: your output)
                  PipeWire "TalkKobold-sink"                    your headphones
                          │                                     (monitor / sidetone)
                          ▼ loopback
                  "TalkKobold Mic"  ◀── selected as mic in Discord / Zoom / …
```

Per-OS provisioning of the virtual device (the only OS-specific piece):

- **Linux** (current dev machine: GNOME/Wayland + PipeWire): app spawns
  `pw-loopback` to create `TalkKobold-sink` (play target) + `TalkKobold Mic`
  (Audio/Source apps pick). Auto-removed on quit.
- **Windows** (later): user installs **VB-Cable** (free) once; app detects it.
- **macOS** (later): user installs **BlackHole** (free) once; app detects it.

## Architecture — portability discipline

Everything OS/runtime-specific sits behind a thin boundary so ~80% of the code
moves to Tauri/mobile untouched.

```
src/
├─ core/                 PORTABLE — no Electron imports
│  ├─ tts.js             ElevenLabs synthesize()  ✅ scaffolded
│  ├─ phrases.js         quick-phrase model        ✅ scaffolded
│  └─ audio.js           routing contract + names  ✅ scaffolded
├─ platform/electron/    Electron-only — swapped for a Rust backend in Tauri
│  ├─ window.js          mini window + toggle()    ✅
│  ├─ hotkey.js          globalShortcut + fallback ✅
│  └─ tray.js            tray icon + menu          ✅
├─ ui/                   web tech — ports as-is
│  ├─ index.html         ✅
│  └─ renderer.js        ✅
├─ preload.js            safe IPC bridge           ✅
└─ main.js               Electron entry, wiring    ✅
scripts/gen-icon.js      generates assets/icon.png ✅
```

## Hotkey & the Wayland caveat

Default toggle: **`Ctrl+Alt+Space`**. Hidden/unfocused → show + focus the text
box; focused → hide. Electron runs under XWayland, where `globalShortcut` works
(verified booting on this machine). If a locked-down native-Wayland session
refuses it, the fallback is a **GNOME Custom Shortcut** bound to
`npm run toggle`, which reaches the running instance via the single-instance
lock and toggles the window. See `NEXT-STEPS.md`.

## Mobile reality (expectations set early)

iOS and Android **sandbox the microphone** — no app can inject audio into it, so
the desktop "virtual mic into a call" trick is **impossible on mobile**. The
mobile version (later) will instead be a **speak-out-loud AAC soundboard**:
type/tap a phrase, the phone plays it through its speaker for in-person
conversation. The `core/` and `ui/` code carry over; only the virtual-mic
feature is desktop-only.

## Build phases

- [x] **Phase 1 — Skeleton.** Window + tray + single-instance + hotkey toggle.
      *(done; boots clean, hotkey registered)*
- [x] **Phase 2 — TTS.** Settings (API key, voice, model), type → speak via
      `core/tts.js` (synthesis in main, playback in the renderer). Voice picker
      (`/voices`) + manual ID, error states in the status bar.
      *(built; final "you hear it" check needs your ElevenLabs key — see
      NEXT-STEPS.md)*
- [x] **Phase 3 — Virtual mic + monitoring.** App spawns `pw-loopback`
      (`TalkKobold-sink` → `TalkKobold Mic`), auto-removed on quit; renderer
      routes playback to the sink via `setSinkId`, plus a monitor path with
      volume + mute. *(verified: a 440 Hz tone played into the sink was captured
      from the virtual mic at full level)*
- [x] **Phase 4 — Quick phrases.** Editable, persisted grid served from
      `core/phrases.js` over IPC (add / rename / delete, normalised + saved).
- [ ] **Phase 5 — Polish.** Wayland hotkey fallback UX, autostart, README for
      selecting "TalkKobold Mic" in Discord/Zoom, error handling, latency tuning.
- [ ] **Later — Tauri port** (swap `platform/electron/` for Rust + cpal/rodio),
      then **mobile** soundboard.

## Open items / risks

- **ElevenLabs API key** required before phase 2 (free tier is fine for testing).
- **Chromium OS sandbox** needs a one-time root fixup on Linux, or run
  `npm run dev` (`--no-sandbox`) for development — see `NEXT-STEPS.md`.
- **Tray on GNOME** is hidden without the AppIndicator extension; non-blocking,
  the hotkey is the primary control.
- **Webview audio in Tauri**: `setSinkId` is unreliable in WebKitGTK/WKWebView,
  which is why the Tauri port moves audio into Rust (already accounted for).
