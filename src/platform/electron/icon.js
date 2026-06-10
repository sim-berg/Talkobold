// Electron-specific: resolves the app icon used by the window and tray.
// Precedence: the user's assets/icon.png, then the generated
// assets/icon.default.png, then an empty image (never throws).
const fs = require('fs');
const path = require('path');
const { nativeImage } = require('electron');

const ASSETS = path.join(__dirname, '..', '..', '..', 'assets');
const USER = path.join(ASSETS, 'icon.png');
const FALLBACK = path.join(ASSETS, 'icon.default.png');

/** Absolute path to the icon to use, or null if none exists. */
function iconPath() {
  if (fs.existsSync(USER)) return USER;
  if (fs.existsSync(FALLBACK)) return FALLBACK;
  return null;
}

/** A nativeImage for the icon (empty image if none / unreadable). */
function iconImage() {
  const p = iconPath();
  if (!p) return nativeImage.createEmpty();
  const img = nativeImage.createFromPath(p);
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

/** PNG data URL for the icon, or null — lets the sandboxed renderer show it. */
function iconDataUrl() {
  const p = iconPath();
  if (!p) return null;
  try {
    return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
  } catch {
    return null;
  }
}

module.exports = { iconPath, iconImage, iconDataUrl, USER_ICON_PATH: USER };
