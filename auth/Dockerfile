FROM oven/bun:1-slim

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

COPY server.ts store.ts ui.ts admin.ts fragments.ts invite.ts passkey.ts ./
COPY assets ./assets

ENV NODE_ENV=production

EXPOSE 8099

CMD ["bun", "run", "server.ts"]
