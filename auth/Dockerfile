FROM oven/bun:1-slim

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

COPY server.ts store.ts ui.ts admin.ts fragments.ts invite.ts passkey.ts ./
COPY assets ./assets

# Bundle the WebAuthn browser library into the image so the login page never
# runs third-party JavaScript from a CDN on the auth origin.
RUN bun build node_modules/@simplewebauthn/browser/esm/index.js \
      --target browser --format esm --minify --outfile assets/webauthn.js

ENV NODE_ENV=production

EXPOSE 8099

CMD ["bun", "run", "server.ts"]
