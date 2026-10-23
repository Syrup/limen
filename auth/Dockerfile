FROM oven/bun:1-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

COPY server.ts store.ts ui.ts admin.ts fragments.ts invite.ts passkey.ts config.ts healthcheck.ts ./
COPY assets ./assets

# Bundle the WebAuthn browser library into the image so the login page never
# runs third-party JavaScript from a CDN on the auth origin.
RUN bun build node_modules/@simplewebauthn/browser/esm/index.js \
      --target browser --format esm --minify --outfile assets/webauthn.js

ENV NODE_ENV=production

EXPOSE 8099

CMD ["bun", "run", "server.ts"]
