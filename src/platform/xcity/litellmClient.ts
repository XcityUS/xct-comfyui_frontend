import {
  clearXcityIdentity,
  getXcityIdentity
} from '@/platform/xcity/xcityIdentity'

export class LitellmError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'LitellmError'
    this.status = status
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
}

/**
 * Fetch from the user's gateway (`api_base` from the identity envelope) with
 * their LiteLLM bearer. A 401 means the key was rotated server-side, so the
 * cached identity is dropped and the request retried once with a fresh key.
 */
async function gatewayFetch(
  path: string,
  options: RequestOptions = {},
  allowRetry = true
): Promise<Response> {
  const identity = await getXcityIdentity()
  const hasBody = options.body !== undefined

  const headers = new Headers()
  headers.set('Authorization', `Bearer ${identity.key}`)
  if (hasBody) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${identity.api_base}${path}`, {
    method: options.method ?? (hasBody ? 'POST' : 'GET'),
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    signal: options.signal
  })

  if (response.status === 401 && allowRetry) {
    clearXcityIdentity()
    return gatewayFetch(path, options, false)
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText)
    throw new LitellmError(response.status, detail)
  }

  return response
}

async function gatewayJson<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const response = await gatewayFetch(path, options)
  return (await response.json()) as T
}

/** The models the current user's plan is allowed to invoke. */
export async function getAvailableModels(): Promise<string[]> {
  const identity = await getXcityIdentity()
  return identity.models
}

export interface ImageGenerationParams {
  model: string
  prompt: string
  size?: string
  n?: number
}

export interface LitellmImage {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export async function generateImages(
  params: ImageGenerationParams,
  signal?: AbortSignal
): Promise<LitellmImage[]> {
  const { data } = await gatewayJson<{ data: LitellmImage[] }>(
    '/v1/images/generations',
    { body: params, signal }
  )
  return data
}

type VideoStatus =
  | 'queued'
  | 'in_progress'
  | 'processing'
  | 'completed'
  | 'succeeded'
  | 'failed'

export interface LitellmVideo {
  id: string
  status: VideoStatus
  progress?: number
  error?: { message?: string } | string | null
}

export interface VideoGenerationParams {
  model: string
  prompt: string
  seconds?: string
  size?: string
}

export function createVideo(
  params: VideoGenerationParams,
  signal?: AbortSignal
): Promise<LitellmVideo> {
  return gatewayJson<LitellmVideo>('/v1/videos', { body: params, signal })
}

function getVideo(
  videoId: string,
  signal?: AbortSignal
): Promise<LitellmVideo> {
  return gatewayJson<LitellmVideo>(`/v1/videos/${videoId}`, { signal })
}

export async function fetchVideoContent(
  videoId: string,
  signal?: AbortSignal
): Promise<Blob> {
  const response = await gatewayFetch(`/v1/videos/${videoId}/content`, {
    signal
  })
  return response.blob()
}

const TERMINAL_SUCCESS: ReadonlySet<VideoStatus> = new Set([
  'completed',
  'succeeded'
])

interface PollVideoOptions {
  intervalMs?: number
  signal?: AbortSignal
  onUpdate?: (video: LitellmVideo) => void
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new LitellmError(0, 'Video polling aborted'))
      },
      { once: true }
    )
  })
}

export async function pollVideo(
  videoId: string,
  { intervalMs = 3000, signal, onUpdate }: PollVideoOptions = {}
): Promise<LitellmVideo> {
  for (;;) {
    const video = await getVideo(videoId, signal)
    onUpdate?.(video)

    if (TERMINAL_SUCCESS.has(video.status)) return video
    if (video.status === 'failed') {
      const reason =
        typeof video.error === 'string'
          ? video.error
          : (video.error?.message ?? 'Video generation failed')
      throw new LitellmError(0, reason)
    }

    await delay(intervalMs, signal)
  }
}
