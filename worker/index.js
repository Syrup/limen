/**
 * Edge host filter. The wildcard DNS record makes every name under the zone
 * resolve, so this rejects anything that is not the apex, the auth host, or a
 * p<port> host before the request touches the tunnel.
 *
 * Configured through [vars] in wrangler.toml.
 */
export default {
  async fetch(request, env) {
    const domain = String(env.LIMEN_DOMAIN || "").toLowerCase();
    const authHost = String(env.LIMEN_AUTH_HOST || "").toLowerCase();

    if (domain) {
      const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const portHost = new RegExp(`^p[1-9][0-9]{0,4}\\.${escaped}$`);
      const host = new URL(request.url).hostname.toLowerCase();

      if (host === domain || (authHost && host === authHost) || portHost.test(host)) {
        return fetch(request);
      }
    }

    return new Response("Not found\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-host-filter": "blocked",
      },
    });
  },
};
