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

export async function litellmRequest<T>(
  path: string,
  options: LitellmRequestOptions = {}
): Promise<T> {
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
