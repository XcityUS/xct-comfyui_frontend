# Restore the full ComfyUI workspace on motion.xcity.ai

Date: 2026-07-30
Status: implemented on `feat/restore-full-comfyui` (PR #27)

## Background

motion.xcity.ai serves this fork as a static nginx container (Railway project
`xct-comfyui-frontent`, service `@comfyorg/website`). Historically no ComfyUI
server backed the deployment, so the `isXcityApp` build force-redirected `'/'`
to `/create` (the Seedance media generator) and the graph workspace was
unreachable. A ComfyUI v0.29.0 backend now runs as the `comfyui-backend`
service in the same project/environment (CPU-only, `--listen 0.0.0.0,::`,
port 8188, reachable at `comfyui-backend.railway.internal`), which makes the
full workspace viable. Product direction: Jimeng-style consumer modules live
in studio.xcity.ai; motion.xcity.ai is the full-featured professional
workflow surface.

## Design

1. **Upstream sync.** Merge tag `v1.47.10` — the exact frontend version the
   backend requires. Only conflict: `src/stores/authStore.ts`; resolution
   keeps the fork's nullable `useFirebaseAuth()` + `if (auth)` wrapper while
   adopting upstream's new logic (`getShareAuthMetadata`, `mintAtLogin`,
   `unifiedCloudAuthEnabled` rotation gating).

2. **Route restore.** Remove the `'/' → /create` redirect in `src/router.ts`.
   The `getXcityIdentity()` guard still runs on every navigation (401 →
   redirect to `${XCITY_HOME_URL}/login?return=…`); `/create` stays.

3. **Same-origin backend proxy.** The production frontend hardcodes
   `location.host` for API calls, so instead of cross-origin config the nginx
   layer proxies `/ws` (WebSocket upgrade), `/api`, `/extensions`,
   `/templates`, `/view`, `/docs` to `COMFYUI_BACKEND_ORIGIN`
   (default `http://comfyui-backend.railway.internal:8188`, private IPv6
   networking; DNS via `COMFYUI_DNS_RESOLVER`, default `fd12::10`, resolved
   at request time through a variable `proxy_pass`). `/internal` is
   deliberately not proxied (filesystem disclosure routes, unused by the
   cloud-distribution frontend).

4. **Branding.** Tab title/favicon/apple-touch-icon/PWA manifest → Xcity
   Motion with the official icon set (same source as xct-home/xct-studio);
   `useBrowserTabTitle` picks the Xcity name only under `isXcityApp`; the
   Comfy Cloud SEO/OG html injection is skipped for xcity builds;
   `DEFAULT_XCITY_HOME_URL` now `https://xcity.ai`.

## Security posture

- The backend has no public domain dependency: the proxy is the only path in
  (its Railway-generated domain can be removed once the proxy is verified).
- Abuse damping at the edge: `limit_req` 20 r/s + burst 60, `limit_conn` 20,
  64 MB upload cap, `X-Forwarded-For`/`X-Real-IP` forwarded for attribution.
- **Accepted risk (tracked follow-up):** the xcity identity gate is
  client-side; the proxied API is reachable unauthenticated. The xcity
  session cookie is host-only on xcity.ai, so motion's edge cannot validate
  it directly. Closing this needs a motion-scoped session (e.g. an
  `auth_request` flow minting a cookie after an xcity-home identity check).
- Related: ComfyUI runs single-user, so authenticated users share one
  workspace (workflows/history/outputs mutually visible; `/ws` broadcasts
  execution events). If unacceptable, run the backend `--multi-user` and
  inject a per-identity `comfy-user` header at the proxy.

## Verification

- `pnpm typecheck` clean; oxfmt/eslint/oxlint clean via lint-staged hooks.
- Unit: `src/platform/xcity` 19/19, authStore suite green (87 total).
- `VITE_XCITY_APP=true pnpm build:cloud`: single `<title>Xcity Motion</title>`,
  `https://xcity.ai` constant-folded into the identity chunk, xcity icons in
  `dist/assets/images/`.
- Independent adversarial code review: merge fidelity, proxy route
  completeness for the 1.47 frontend, and fork-feature survival all
  confirmed; 8 findings addressed or explicitly accepted (above).
- Post-deploy smoke: workspace loads at `/`, `/ws` connects, `/api/system_stats`
  proxied, `/create` renders, logged-out navigation bounces to xcity.ai login,
  `/internal/*` returns 404/blocked.

## Known limitations

- CPU-only backend: graph editing and queueing are fully functional, but
  generation is slow; suited to workflow authoring and API validation.
- `DISTRIBUTION=cloud` against an OSS backend: the logs/terminal panel 404s
  (`/api/logs` is cloud-only) and `/api/features` 404s (handled gracefully).
