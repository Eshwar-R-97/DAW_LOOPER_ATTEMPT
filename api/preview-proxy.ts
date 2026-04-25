// UNTESTED — requires `vercel dev` to run locally
export const config = { runtime: 'edge' }

const ALLOWED_DOMAINS = [
  'cdn.freesound.org',
  'freesound.org',
  'looperman.com',
  'cdn.looperman.com',
]

function isDomainAllowed(hostname: string): boolean {
  return ALLOWED_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith(`.${d}`)
  )
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const targetUrl = searchParams.get('url')

  if (!targetUrl) {
    return new Response('url param required', { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(targetUrl)
  } catch {
    return new Response('invalid url', { status: 400 })
  }

  if (parsedUrl.protocol !== 'https:') {
    return new Response('https only', { status: 403 })
  }

  if (!isDomainAllowed(parsedUrl.hostname)) {
    return new Response('domain not allowed', { status: 403 })
  }

  const upstream = await fetch(targetUrl, {
    headers: { 'User-Agent': 'DAWLooper/1.0' },
    signal: req.signal,
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'audio/mpeg',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
