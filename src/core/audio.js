// PORTABLE core: audio routing contract.
//
// In the Electron build, playback happens in the renderer via
// HTMLAudioElement.setSinkId() — one element targeting the virtual mic
// (what friends hear) and one targeting the monitor device (what YOU hear,
// the "hear your own voice" feature). This module documents that contract so
// the Tauri port can swap in a Rust (cpal/rodio) implementation with the same
// shape.
//
// Targets:
//   - VIRTUAL_MIC: deviceId of the virtual sink (e.g. PipeWire "Talkobold-sink")
//   - MONITOR:     deviceId of the user's real output (sidetone), with its own
//                  volume + mute, so they can hear what they're "saying".

/** @typedef {Object} PlaybackTargets
 *  @property {string|null} virtualMicDeviceId
 *  @property {string|null} monitorDeviceId
 *  @property {number} monitorVolume  // 0..1
 *  @property {boolean} monitorMuted
 */

/** Default routing config before the user picks devices. */
function defaultTargets() {
  return {
    virtualMicDeviceId: null,
    monitorDeviceId: 'default',
    monitorVolume: 0.6,
    monitorMuted: false,
  };
}

// Stable name we give the PipeWire virtual sink/source so the renderer can
// find it in enumerateDevices() by label.
const VIRTUAL_MIC_LABEL = 'Talkobold Mic';
const VIRTUAL_SINK_NODE = 'Talkobold-sink';
const VIRTUAL_SOURCE_NODE = 'talkobold-mic';

module.exports = {
  defaultTargets,
  VIRTUAL_MIC_LABEL,
  VIRTUAL_SINK_NODE,
  VIRTUAL_SOURCE_NODE,
};
