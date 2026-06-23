/**
 * Raw microphone constraints — disables browser DSP that dampens transients
 * (AGC, noise suppression, echo cancellation).
 */
export const RAW_MIC_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
}

export const MIC_GET_USER_MEDIA_OPTIONS: MediaStreamConstraints = {
  audio: RAW_MIC_AUDIO_CONSTRAINTS,
}
