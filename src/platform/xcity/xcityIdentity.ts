import { getXcityHomeUrl } from '@/config/xcity'

/**
 * The identity envelope returned by xcity-home's `/api/me/litellm-key`.
 * `key` is the user's LiteLLM bearer, `api_base` the gateway to call, and
 * `models` the IDs the user's plan is allowed to invoke.
 */
export interface XcityIdentity {
  key: string
  plan: string
  models: string[]
  api_base: string
}

export class XcityAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'XcityAuthError'
  }
}

const STORAGE_KEY = 'xcity_identity_v1'
const TTL_MS = 5 * 60 * 1000

interface CachedIdentity {
  identity: XcityIdentity
  expires: number
}

function readCache(): XcityIdentity | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null
  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CachedIdentity
    return Date.now() < parsed.expires ? parsed.identity : null
  } catch {
    return null
  }
}

function writeCache(identity: XcityIdentity): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  const value: CachedIdentity = { identity, expires: Date.now() + TTL_MS }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

function redirectToLogin(): void {
  const target = encodeURIComponent(window.location.href)
  window.location.href = `${getXcityHomeUrl()}/login?return=${target}`
}

/**
 * Resolve the current user's xcity identity envelope.
 *
 * Returns a cached envelope when fresh; otherwise calls xcity-home with the
 * `.xcity.one` session cookie (`credentials: 'include'`). On 401 the user is
 * not signed in: redirects the browser to xcity-home login and throws so the
 * in-flight flow stops while navigation happens.
 */
export async function getXcityIdentity(
  options: { forceRefresh?: boolean } = {}
): Promise<XcityIdentity> {
  if (!options.forceRefresh) {
    const cached = readCache()
    if (cached) return cached
  }

  const response = await fetch(`${getXcityHomeUrl()}/api/me/litellm-key`, {
    credentials: 'include'
  })

  if (response.status === 401) {
    redirectToLogin()
    throw new XcityAuthError('Not signed in to xcity.one')
  }
  if (!response.ok) {
    throw new XcityAuthError(`xcity identity failed: ${response.status}`)
  }

  const identity = (await response.json()) as XcityIdentity
  writeCache(identity)
  return identity
}

export function clearXcityIdentity(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  window.sessionStorage.removeItem(STORAGE_KEY)
}
