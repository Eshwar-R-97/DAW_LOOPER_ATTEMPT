export {}

declare global {
  interface Window {
    audioHost?: {
      ping: () => Promise<{ ok: boolean; version?: string }>
      getDevices: () => Promise<{
        inputs: Array<{ name: string; type: string; direction: string }>
        outputs: Array<{ name: string; type: string; direction: string }>
        active?: { name: string; sampleRate: number; bufferSize: number }
      }>
      setDevice: (params: {
        input?: string
        output?: string
        sampleRate?: number
        bufferSize?: number
      }) => Promise<{ ok: boolean }>
    }
  }
}
