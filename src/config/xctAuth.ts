const DEFAULT_XCT_AUTH_URL = 'https://auth.xcity.one'
const DEFAULT_LITELLM_BASE_URL = 'https://tokenhub.xcity.one'

export function getXctAuthUrl(): string {
  return import.meta.env.VITE_XCT_AUTH_URL ?? DEFAULT_XCT_AUTH_URL
}

export function getLitellmBaseUrl(): string {
  return import.meta.env.VITE_LITELLM_BASE_URL ?? DEFAULT_LITELLM_BASE_URL
}
