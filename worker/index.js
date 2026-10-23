const PORT_HOST = /^p[1-9][0-9]{0,4}\.keraki\.tech$/;
const ALLOWED_EXACT = new Set(["example.com", "auth.example.com"]);

export default {
  async fetch(request) {
    const host = new URL(request.url).hostname;

    if (ALLOWED_EXACT.has(host) || PORT_HOST.test(host)) {
      return fetch(request);
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
