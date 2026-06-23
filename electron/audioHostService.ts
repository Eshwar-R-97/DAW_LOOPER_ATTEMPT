import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import readline from 'node:readline'
import fs from 'node:fs'
import path from 'node:path'

export interface JsonRpcRequest {
  id: string
  method: string
  params?: Record<string, unknown>
}

export interface JsonRpcResponse<T = unknown> {
  id: string
  result?: T
  error?: { code: number; message: string }
}

export interface AudioDeviceInfo {
  name: string
  type: string
  direction: 'input' | 'output'
}

export interface GetDevicesResult {
  inputs: AudioDeviceInfo[]
  outputs: AudioDeviceInfo[]
  active?: {
    name: string
    sampleRate: number
    bufferSize: number
  }
}

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

export type SpawnFn = (
  command: string,
  args?: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv }
) => ChildProcessWithoutNullStreams

const DEFAULT_READY_TIMEOUT_MS = 10_000
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

export function resolveAudioHostBinary(cwd = process.cwd(), resourcesPath?: string, isPackaged = false): string {
  if (isPackaged && resourcesPath) {
    return path.join(resourcesPath, 'audio-host', 'audio-host')
  }

  const candidates = [
    path.join(cwd, 'native/audio-host/build/audio-host_artefacts/Debug/audio-host'),
    path.join(cwd, 'native/audio-host/build/audio-host_artefacts/Release/audio-host'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  throw new Error('audio-host binary not found. Run `npm run build:native` first.')
}

export class AudioHostService {
  private proc: ChildProcessWithoutNullStreams | null = null
  private rl: readline.Interface | null = null
  private pending = new Map<string, PendingRequest>()
  private nextId = 1
  private started = false

  constructor(
    private readonly options: {
      cwd?: string
      resourcesPath?: string
      isPackaged?: boolean
      readyTimeoutMs?: number
      requestTimeoutMs?: number
      spawnFn?: SpawnFn
    } = {}
  ) {}

  get isRunning(): boolean {
    return this.started && this.proc !== null
  }

  async start(): Promise<void> {
    if (this.started) return

    const spawnFn = this.options.spawnFn ?? spawn
    const binary = this.options.spawnFn
      ? 'audio-host'
      : resolveAudioHostBinary(
          this.options.cwd,
          this.options.resourcesPath,
          this.options.isPackaged ?? false
        )

    this.proc = spawnFn(binary, [], {
      cwd: this.options.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this.proc.stderr.on('data', (chunk: Buffer) => {
      console.error(`[audio-host] ${chunk.toString().trim()}`)
    })

    this.proc.on('exit', (code, signal) => {
      this.started = false
      this.rejectAllPending(new Error(`audio-host exited (code=${code}, signal=${signal})`))
    })

    this.rl = readline.createInterface({ input: this.proc.stdout })
    this.rl.on('line', (line) => this.handleLine(line))

    await this.request('ping', {}, this.options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS)
    this.started = true
  }

  async stop(): Promise<void> {
    if (!this.proc) return

    try {
      await this.request('shutdown', {}, 5_000)
    } catch {
      // Process may already be shutting down.
    }

    this.cleanup()
  }

  ping(): Promise<{ ok: boolean; version?: string }> {
    return this.request('ping')
  }

  getDevices(): Promise<GetDevicesResult> {
    return this.request('get_devices')
  }

  setDevice(params: {
    input?: string
    output?: string
    sampleRate?: number
    bufferSize?: number
  }): Promise<{ ok: boolean }> {
    return this.request('set_device', params)
  }

  private async request<T>(method: string, params: Record<string, unknown> = {}, timeoutMs?: number): Promise<T> {
    if (!this.proc?.stdin?.writable) {
      throw new Error('audio-host is not running')
    }

    const id = String(this.nextId++)
    const payload: JsonRpcRequest = { id, method, params }

    const effectiveTimeout = timeoutMs ?? this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`audio-host request timed out: ${method}`))
      }, effectiveTimeout)

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      })

      this.proc!.stdin!.write(`${JSON.stringify(payload)}\n`)
    })
  }

  private handleLine(line: string): void {
    let parsed: JsonRpcResponse
    try {
      parsed = JSON.parse(line) as JsonRpcResponse
    } catch {
      console.error('[audio-host] invalid JSON response:', line)
      return
    }

    const pending = this.pending.get(parsed.id)
    if (!pending) return

    clearTimeout(pending.timer)
    this.pending.delete(parsed.id)

    if (parsed.error) {
      pending.reject(new Error(parsed.error.message))
      return
    }

    pending.resolve(parsed.result)
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }

  private cleanup(): void {
    this.rejectAllPending(new Error('audio-host stopped'))
    this.rl?.close()
    this.rl = null

    if (this.proc && !this.proc.killed) {
      this.proc.kill()
    }

    this.proc = null
    this.started = false
  }
}
