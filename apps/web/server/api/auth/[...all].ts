/**
 * Same-origin proxy for Better Auth.
 *
 * The Better Auth server runs inside Convex and is exposed at
 * `${CONVEX_SITE_URL}/api/auth/*`. Proxying it from `/api/auth/*` keeps the
 * session cookie first-party (issued for the app origin, not `*.convex.site`).
 *
 * Method, query string, body and request headers pass through unchanged -
 * including `Origin` (checked by Convex against `trustedOrigins`) and `Cookie`;
 * h3's `getProxyRequestHeaders` only strips hop-by-hop headers and `host`.
 * `Set-Cookie` from Convex is copied back onto the response by `proxyRequest`.
 *
 * This is the only Nitro route in the app.
 */
export default defineEventHandler((event) => {
  const { convexSiteUrl } = useRuntimeConfig(event);
  if (!convexSiteUrl) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Auth proxy is not configured: set NUXT_CONVEX_SITE_URL to the *.convex.site URL",
    });
  }

  const rest = getRouterParam(event, "all") ?? "";
  const { search } = getRequestURL(event);
  const target = `${convexSiteUrl.replace(/\/+$/, "")}/api/auth/${rest}${search}`;

  return proxyRequest(event, target, { headers: getProxyRequestHeaders(event) });
});
