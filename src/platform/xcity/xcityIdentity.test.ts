import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  XcityAuthError,
  clearXcityIdentity,
  getXcityIdentity
} from './xcityIdentity'

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

describe('xcityIdentity', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window, 'location', {
      value: { href: 'https://motion.xcity.one/create' },
      writable: true,
      configurable: true
    })
    sessionStorage.clear()
    clearXcityIdentity()
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(ENVELOPE)))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('fetches the identity envelope with the session cookie', async () => {
    const id = await getXcityIdentity()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://xcity.one/api/me/litellm-key')
    expect(init.credentials).toBe('include')
    expect(id).toEqual(ENVELOPE)
  })

  it('caches the envelope and does not refetch within the TTL', async () => {
    await getXcityIdentity()
    await getXcityIdentity()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refetches after clearXcityIdentity()', async () => {
    await getXcityIdentity()
    clearXcityIdentity()
    await getXcityIdentity()

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('redirects to xcity-home login and throws on 401', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 401 }))

    await expect(getXcityIdentity()).rejects.toBeInstanceOf(XcityAuthError)
    expect(window.location.href).toBe(
      'https://xcity.one/login?return=' +
        encodeURIComponent('https://motion.xcity.one/create')
    )
  })
})
