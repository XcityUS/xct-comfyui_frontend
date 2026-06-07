import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LitellmError,
  createVideo,
  fetchVideoContent,
  generateImages,
  getVideo,
  listLitellmModels,
  litellmRequest,
  pollVideo
} from './litellmClient'

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn()
}))

vi.mock('@/platform/xctauth/stores/xctAuthStore', () => ({
  useXctAuthStore: () => ({ getAccessToken: mocks.getAccessToken })
}))

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('litellmClient', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    mocks.getAccessToken.mockResolvedValue('jwt-token')
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('targets the litellm base url and attaches the Bearer token', async () => {
    await litellmRequest('/v1/models')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://tokenhub.xcity.one/v1/models')
    expect((init.headers as Headers).get('Authorization')).toBe(
      'Bearer jwt-token'
    )
    expect(init.method).toBe('GET')
  })

  it('omits the Authorization header when there is no token', async () => {
    mocks.getAccessToken.mockResolvedValue(null)

    await litellmRequest('/v1/models')

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Headers).get('Authorization')).toBeNull()
  })

  it('sends a JSON POST when a body is provided', async () => {
    await litellmRequest('/v1/chat/completions', {
      body: { model: 'seedance', messages: [] }
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect((init.headers as Headers).get('Content-Type')).toBe(
      'application/json'
    )
    expect(init.body).toBe('{"model":"seedance","messages":[]}')
  })

  it('throws LitellmError carrying the HTTP status on failure', async () => {
    fetchMock.mockResolvedValue(new Response('unauthorized', { status: 401 }))

    await expect(litellmRequest('/v1/models')).rejects.toMatchObject({
      name: 'LitellmError',
      status: 401
    })
    await expect(litellmRequest('/v1/models')).rejects.toBeInstanceOf(
      LitellmError
    )
  })

  it('unwraps the model list from the OpenAI-style envelope', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: [{ id: 'seedance-2.0' }, { id: 'gpt-4o' }] })
    )

    const models = await listLitellmModels()

    expect(models.map((m) => m.id)).toEqual(['seedance-2.0', 'gpt-4o'])
  })

  it('posts to the images endpoint and returns the image list', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: [{ url: 'https://cdn/img.png' }] })
    )

    const images = await generateImages({ model: 'flux', prompt: 'a cat' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://tokenhub.xcity.one/v1/images/generations')
    expect(init.body).toBe('{"model":"flux","prompt":"a cat"}')
    expect(images[0].url).toBe('https://cdn/img.png')
  })

  it('creates a video job and reads its status', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'vid_1', status: 'queued' })
    )
    const created = await createVideo({ model: 'seedance-2.0', prompt: 'surf' })
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://tokenhub.xcity.one/v1/videos'
    )
    expect(created).toMatchObject({ id: 'vid_1', status: 'queued' })

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'vid_1', status: 'completed', progress: 100 })
    )
    const status = await getVideo('vid_1')
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://tokenhub.xcity.one/v1/videos/vid_1'
    )
    expect(status.status).toBe('completed')
  })

  it('fetches video content as a Blob from the content endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response('binary', {
        status: 200,
        headers: { 'Content-Type': 'video/mp4' }
      })
    )

    const blob = await fetchVideoContent('vid_1')

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://tokenhub.xcity.one/v1/videos/vid_1/content'
    )
    expect(blob).toBeInstanceOf(Blob)
  })

  it('polls a video until it reaches a terminal success status', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: 'v', status: 'queued' }))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'v', status: 'in_progress', progress: 40 })
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: 'v', status: 'completed', progress: 100 })
      )
    const updates: number[] = []

    const result = await pollVideo('v', {
      intervalMs: 0,
      onUpdate: (video) => updates.push(video.progress ?? 0)
    })

    expect(result.status).toBe('completed')
    expect(updates).toEqual([0, 40, 100])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('rejects with the error reason when a video poll reports failure', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: 'v', status: 'failed', error: { message: 'nsfw' } })
    )

    await expect(pollVideo('v', { intervalMs: 0 })).rejects.toMatchObject({
      name: 'LitellmError',
      message: 'nsfw'
    })
  })
})
