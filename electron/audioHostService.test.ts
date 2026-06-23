import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { AudioHostService, resolveAudioHostBinary, type SpawnFn } from './audioHostService'

class MockChildProcess extends EventEmitter {
  stdin = new PassThrough()
  stdout = new PassThrough()
  stderr = new PassThrough()
  killed = false

  kill(): boolean {
    this.killed = true
    this.emit('exit', 0, null)
    return true
  }
}

function createMockSpawn(responseForMethod: Record<string, unknown>): SpawnFn {
  return () => {
    const proc = new MockChildProcess()

    proc.stdin.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim()
      const request = JSON.parse(line) as { id: string; method: string }
      const result = responseForMethod[request.method] ?? { ok: true }
      proc.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`)
    })

    return proc as unknown as ReturnType<SpawnFn>
  }
}

describe('resolveAudioHostBinary', () => {
  it('returns packaged binary path when packaged', () => {
    const resolved = resolveAudioHostBinary('/tmp/project', '/tmp/resources', true)
    expect(resolved).toBe('/tmp/resources/audio-host/audio-host')
  })
})

describe('AudioHostService', () => {
  let service: AudioHostService

  beforeEach(() => {
    service = new AudioHostService({
      cwd: '/tmp/project',
      spawnFn: createMockSpawn({
        ping: { ok: true, version: '0.1.0' },
        shutdown: { ok: true },
        get_devices: {
          inputs: [{ name: 'Mic', type: 'CoreAudio', direction: 'input' }],
          outputs: [{ name: 'Speakers', type: 'CoreAudio', direction: 'output' }],
        },
        set_device: { ok: true },
      }),
    })
  })

  afterEach(async () => {
    if (service.isRunning) {
      await service.stop()
    }
  })

  it('starts with a ping handshake', async () => {
    await service.start()
    expect(service.isRunning).toBe(true)
    const pong = await service.ping()
    expect(pong.ok).toBe(true)
  })

  it('returns audio devices from get_devices', async () => {
    await service.start()
    const devices = await service.getDevices()
    expect(devices.inputs).toHaveLength(1)
    expect(devices.outputs).toHaveLength(1)
  })

  it('stops cleanly after shutdown', async () => {
    await service.start()
    await service.stop()
    expect(service.isRunning).toBe(false)
  })
})
