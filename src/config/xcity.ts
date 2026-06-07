const DEFAULT_XCITY_HOME_URL = 'https://xcity.one'

/**
 * When true, this build runs as an xcity.one sub-product (e.g. motion.xcity.one):
 * identity and the LiteLLM key come from xcity-home, not Firebase. The build
 * must be served from a `*.xcity.one` subdomain for the session cookie to attach.
 * Enable with VITE_XCITY_APP=true.
 */
export const isXcityApp = import.meta.env.VITE_XCITY_APP === 'true'

export function getXcityHomeUrl(): string {
  return import.meta.env.VITE_XCITY_HOME_URL ?? DEFAULT_XCITY_HOME_URL
}
