const DEFAULT_XCITY_HOME_URL = 'https://xcity.ai'

/**
 * When true, this build runs as an xcity.ai sub-product (e.g. motion.xcity.ai):
 * identity and the LiteLLM key come from xcity-home, not Firebase. The build
 * must be served from a `*.xcity.ai` subdomain for the session cookie to attach.
 * Enable with VITE_XCITY_APP=true.
 */
export const isXcityApp = import.meta.env.VITE_XCITY_APP === 'true'

export function getXcityHomeUrl(): string {
  return import.meta.env.VITE_XCITY_HOME_URL ?? DEFAULT_XCITY_HOME_URL
}
