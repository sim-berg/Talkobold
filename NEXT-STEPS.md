# Next steps

Phase 1 is done and boots. Here's how to run it and what comes next.

## 1. Run it right now

```bash
npm install            # re-run if node_modules is missing
npm run gen-icon       # generates the fallback assets/icon.default.png
npm run dev            # launches with --no-sandbox (easiest for development)
```

**First launch shows the window** with a short setup wizard (API key → voice →
virtual mic → "hear yourself" + show-on-launch). After you finish it, the
window's visibility on later launches follows the **"Show window when
TalkKobold starts"** setting (on by default — recommended if the hotkey doesn't
fire on your system).

Summon / hide any time with the hotkey:

> **`Ctrl + Alt + Space`** → window appears, text box focused. Press it again → hides.
> `Esc` or the `×` also hides it.

Type something and hit **Enter** to speak it (needs your ElevenLabs key from the
wizard / Settings). You can re-run the wizard from **Settings → Replay setup
wizard**.

### Use your own app icon

Drop a square **PNG** at **`assets/icon.png`** and restart — it's used for the
window, tray, and the wizard logo. Without it, the generated
`assets/icon.default.png` placeholder is used. (`gen-icon` only writes the
placeholder, so it never overwrites your icon.)

### Fix the Chromium sandbox (so `npm start` works without `--no-sandbox`)

One-time, needs sudo (this is the standard Electron-on-Linux fixup):

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755   node_modules/electron/dist/chrome-sandbox
npm start          # now runs with the sandbox enabled
```

If you skip this, just use `npm run dev`.

## 2. If the global hotkey doesn't work (native-Wayland fallback)

The status bar at the bottom of the window shows the hotkey state. If it says
"hotkey unavailable," set up a GNOME Custom Shortcut instead:

1. **Settings → Keyboard → View and Customize Shortcuts → Custom Shortcuts → +**
2. Name: `TalkKobold toggle`
3. Command: `npm --prefix /home/si/Projects/TalkKobold run toggle`
4. Shortcut: press `Ctrl+Alt+Space`

That command relaunches with `--toggle`; the single-instance lock forwards it to
the running app, which toggles the window.

## 3. Before phase 2 — get an ElevenLabs API key

1. Sign up at <https://elevenlabs.io> (free tier is enough to test).
2. Profile → **API key** → copy it.
3. Pick a voice in their dashboard and note its **Voice ID** (or we'll add a
   voice picker in the app).

Keep the key out of git — phase 2 stores it via the app's settings (and `.env`
/ `config.local.json` are already gitignored).

## 4. Using phases 2–4 (now built)

Open **Settings** (⚙ in the title bar) and:

1. Paste your **ElevenLabs API key**, then click **Refresh** to load your
   voices and pick one (or paste a Voice ID directly). Choose a model
   (Flash v2.5 is the low-latency default).
2. Under **Virtual microphone** you should see *"running — pick TalkKobold Mic
   as your mic"*. The play target (virtual sink) is auto-detected; override it
   if needed.
3. Under **Monitor** toggle "hear your own voice" and choose the output device.
   Volume + mute also live next to the **Speak** button.

Then type and press **Enter** (or click **Speak**, or tap a quick phrase).
Errors (missing key, bad voice, network) show in the status bar.

**Quick phrases:** click **edit** above the grid to add / rename / delete; they
persist to `settings.json` in the app's userData dir.

**Verify the virtual mic** (already smoke-tested in dev):

```bash
wpctl status | grep -i talkkobold     # TalkKobold-sink + talkkobold-mic appear
```

In Discord/Zoom, select **"TalkKobold Mic"** as your microphone; click **Speak**
and your friend hears it, while the monitor path lets you hear yourself.

## Building the Windows installer (one-click `.exe`)

TalkKobold packages to a **one-click NSIS installer** via `electron-builder`.
The installer needs no admin, installs per-user, adds Start Menu + desktop
shortcuts, and launches the app when it finishes.

```bash
npm run dist:win        # → dist/TalkKobold Setup <version>.exe
```

`dist:win` regenerates the fallback icon, stages `build/icon.png` (your
`assets/icon.png` if present, else the default), then runs electron-builder.

### Cross-building from Linux needs Wine (one-time)

electron-builder compiles the NSIS installer with `makensis.exe`, which runs
under **Wine** on Linux. Install it once:

```bash
sudo apt update && sudo apt install -y wine
```

Then `npm run dist:win` produces the `.exe` in `dist/`. (Building on Windows or
a GitHub Actions `windows-latest` runner needs no Wine.)

### The virtual mic on Windows: VB-CABLE

Windows has no `pw-loopback`. The app uses **VB-CABLE** (free virtual audio
device). On first run the wizard detects it and, if missing, offers an
**Install VB-CABLE** button (opens <https://vb-audio.com/Cable/>) + **Re-check**.
After install (reboot if asked), TalkKobold plays into *CABLE Input* and apps
pick *CABLE Output (VB-Audio Virtual Cable)* as the mic. Routing is handled in
`virtualmic.win.js`; the Linux `pw-loopback` path is `virtualmic.linux.js`.

### Custom icon

The build uses **`assets/icon.png`** (yours — a square PNG, ≥256px; 512–1024 is
ideal) for the installer, exe, window, tray, and wizard. Without it the
generated `assets/icon.default.png` placeholder is used.

## Handy checks

```bash
npm run lint:syntax                 # node --check on entry files
wpctl status | grep -i talkkobold   # (phase 3) confirm the virtual mic exists
```
