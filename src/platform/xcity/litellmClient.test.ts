import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LitellmError,
  createVideo,
  fetchVideoContent,
  generateImages,
  getAvailableModels,
  pollVideo
} from './litellmClient'

const identity = vi.hoisted(() => ({
  get: vi.fn(),
  clear: vi.fn()
}))

vi.mock('@/platform/xcity/xcityIdentity', () => ({
  getXcityIdentity: identity.get,
  clearXcityIdentity: identity.clear
}))

const ENVELOPE = {
  key: 'sk-user-1',
  plan: 'pro',
  models: ['seedance-2.0', 'flux'],
  api_base: 'https://tokenhub.xcity.one'
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('xcity litellmClient', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    identity.get.mockResolvedValue(ENVELOPE)
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('reads allowed models from the identity envelope', async () => {
    expect(await getAvailableModels()).toEqual(['seedance-2.0', 'flux'])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls the envelope api_base with the per-user bearer', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ url: 'u' }] }))

    await generateImages({ model: 'flux', prompt: 'a cat' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://tokenhub.xcity.one/v1/images/generations')
    expect((init.headers as Headers).get('Authorization')).toBe(
      'Bearer sk-user-1'
    )
  })

  it('drops the cached key and retries once on a 401', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('rotated', { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ url: 'u' }] }))

    const images = await generateImages({ model: 'flux', prompt: 'x' })

    expect(identity.clear).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(images[0].url).toBe('u')
  })

  it('surfaces non-401 failures as LitellmError', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }))

    await expect(
      generateImages({ model: 'flux', prompt: 'x' })
    ).rejects.toBeInstanceOf(LitellmError)
  })

  it('creates a video and fetches its content as a Blob', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'v1', status: 'queued' })
    )
    const job = await createVideo({ model: 'seedance-2.0', prompt: 'wave' })
    expect(job.id).toBe('v1')

    fetchMock.mockResolvedValueOnce(new Response('mp4', { status: 200 }))
    const blob = await fetchVideoContent('v1')
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://tokenhub.xcity.one/v1/videos/v1/content'
    )
    expect(blob).toBeInstanceOf(Blob)
  })

  it('polls a video until terminal success', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ id: 'v', status: 'in_progress', progress: 50 })
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: 'v', status: 'completed', progress: 100 })
      )
    const seen: number[] = []

    const result = await pollVideo('v', {
      intervalMs: 0,
      onUpdate: (vid) => seen.push(vid.progress ?? 0)
    })

    expect(result.status).toBe('completed')
    expect(seen).toEqual([50, 100])
  })
})
