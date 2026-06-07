import { getLitellmBaseUrl } from '@/config/xctAuth'
import { useXctAuthStore } from '@/platform/xctauth/stores/xctAuthStore'

export class LitellmError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'LitellmError'
    this.status = status
  }
}

interface LitellmRequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
}

async function litellmFetch(
  path: string,
  options: LitellmRequestOptions = {}
): Promise<Response> {
  const token = await useXctAuthStore().getAccessToken()
  const hasBody = options.body !== undefined

  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (hasBody) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${getLitellmBaseUrl()}${path}`, {
    method: options.method ?? (hasBody ? 'POST' : 'GET'),
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    signal: options.signal
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText)
    throw new LitellmError(response.status, detail)
  }

  return response
}

export async function litellmRequest<T>(
  path: string,
  options: LitellmRequestOptions = {}
): Promise<T> {
  const response = await litellmFetch(path, options)
  return (await response.json()) as T
}

export interface LitellmModel {
  id: string
  object?: string
  owned_by?: string
}

export async function listLitellmModels(
  signal?: AbortSignal
): Promise<LitellmModel[]> {
  const { data } = await litellmRequest<{ data: LitellmModel[] }>(
    '/v1/models',
    {
      signal
    }
  )
  return data
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
  const { data } = await litellmRequest<{ data: LitellmImage[] }>(
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
  return litellmRequest<LitellmVideo>('/v1/videos', { body: params, signal })
}

export function getVideo(
  videoId: string,
  signal?: AbortSignal
): Promise<LitellmVideo> {
  return litellmRequest<LitellmVideo>(`/v1/videos/${videoId}`, { signal })
}

export async function fetchVideoContent(
  videoId: string,
  signal?: AbortSignal
): Promise<Blob> {
  const response = await litellmFetch(`/v1/videos/${videoId}/content`, {
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
