import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LitellmError,
  listLitellmModels,
  litellmRequest
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
})
