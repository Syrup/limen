# Frontend assets. Tailwind, htmx, Alpine, and the browser WebAuthn library are
# bundled here, so the runtime image needs neither Node nor those packages.
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
COPY auth/src /auth/src
RUN npm run build

FROM oven/bun:1-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04

WORKDIR /app

COPY auth/package.json auth/bun.lock ./
RUN bun install --production --frozen-lockfile

COPY auth/src ./src
# Static files first (fonts, fonts.css), then the bundle built in the web stage.
COPY auth/assets ./assets
COPY --from=web /auth/assets ./assets

ENV NODE_ENV=production

EXPOSE 8099

CMD ["bun", "run", "src/server.ts"]
