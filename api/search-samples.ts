// UNTESTED — requires `vercel dev` + a live TINYFISH_API_KEY in .env.local
// TinyFish SSE response shape is assumed from docs; may need adjustment after first real run.
import type { SampleResult } from '../src/types/sampleFinder'

export const config = { runtime: 'edge' }

const TINYFISH_AGENT_URL = 'https://agent.tinyfish.ai/v1/automation/run-sse'

interface AgentGoal {
  source: 'freesound' | 'looperman'
  url: string
  goal: string
}

function buildAgentGoals(prompt: string, bpm?: string): AgentGoal[] {
  const encoded = encodeURIComponent(prompt)
  const bpmFilter = bpm ? `&filter=bpm[${bpm} TO ${bpm}]` : ''

  return [
    {
      source: 'freesound',
      url: `https://freesound.org/search/?q=${encoded}${bpmFilter}`,
      goal: `Extract all audio samples from this search results page. For each sample return a JSON object with these fields: name (string), preview_url (the direct mp3 preview URL), download_url (HQ download link if available, else null), bpm (number if shown, else null), tags (array of up to 5 tag strings), duration (number in seconds if shown, else null), source_url (the URL of the sample's detail page). Return results as a JSON array on a single line with no surrounding text.`,
    },
    {
      source: 'looperman',
      url: `https://www.looperman.com/loops?searchterms=${encoded}`,
      goal: `Extract all loops from this search results page. For each loop return a JSON object with these fields: name (string), audio_url (the direct mp3/wav download URL), bpm (number if shown, else null), tags (array of up to 5 tag strings), duration (number in seconds if shown, else null), source_url (the URL of the loop's detail page). Return results as a JSON array on a single line with no surrounding text.`,
    },
  ]
}

function normalizeSampleResult(
  raw: Record<string, unknown>,
  source: AgentGoal['source'],
  index: number
): SampleResult {
  return {
    id: `${source}-${Date.now()}-${index}`,
    source,
    name: String(raw.name ?? 'Untitled'),
    previewUrl: String(raw.preview_url ?? raw.audio_url ?? ''),
    downloadUrl: raw.download_url ? String(raw.download_url) : undefined,
    bpm: raw.bpm != null ? Number(raw.bpm) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 5) : [],
    duration: raw.duration != null ? Number(raw.duration) : undefined,
    sourceUrl: String(raw.source_url ?? ''),
  }
}

async function streamAgentResults(
  goal: AgentGoal,
  apiKey: string,
  signal: AbortSignal,
  onResult: (result: SampleResult) => void
): Promise<void> {
  const response = await fetch(TINYFISH_AGENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ url: goal.url, goal: goal.goal }),
    signal,
  })

  if (!response.ok || !response.body) {
    throw new Error(`TinyFish agent failed for ${goal.source}: ${response.status}`)
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const lines = buffer.split('\n')
    buffer = lines.pop()!

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (!raw || raw === '[DONE]') continue
      try {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          parsed.forEach((item, i) => {
            if (item && typeof item === 'object') {
              onResult(normalizeSampleResult(item as Record<string, unknown>, goal.source, i))
            }
          })
        } else if (parsed && typeof parsed === 'object') {
          const obj = parsed as Record<string, unknown>
          if (obj.type === 'result' && obj.data && typeof obj.data === 'object') {
            onResult(normalizeSampleResult(obj.data as Record<string, unknown>, goal.source, 0))
          } else if (!obj.type) {
            // Top-level object might be a single result
            onResult(normalizeSampleResult(obj, goal.source, 0))
          }
        }
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}

export default async function handler(req: Request): Promise<Response> {
  const apiKey = process.env.TINYFISH_API_KEY
  if (!apiKey) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'API not configured' })}\n\n`,
      { status: 500 }
    )
  }

  const { searchParams } = new URL(req.url)
  const prompt = searchParams.get('prompt') ?? ''
  const bpm = searchParams.get('bpm') ?? undefined

  if (!prompt.trim()) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'prompt required' })}\n\n`,
      { status: 400 }
    )
  }

  const goals = buildAgentGoals(prompt, bpm)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      const emit = (obj: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      await Promise.allSettled(
        goals.map(async (goal) => {
          try {
            await streamAgentResults(goal, apiKey, req.signal, (result) => {
              emit({ type: 'result', data: result })
            })
          } catch (err) {
            emit({ type: 'sourceError', source: goal.source, message: String(err) })
          }
        })
      )

      emit({ type: 'done' })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
