import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('audioHost', {
  ping: () => ipcRenderer.invoke('audio-host:ping'),
  getDevices: () => ipcRenderer.invoke('audio-host:get-devices'),
  setDevice: (params: {
    input?: string
    output?: string
    sampleRate?: number
    bufferSize?: number
  }) => ipcRenderer.invoke('audio-host:set-device', params),
})
