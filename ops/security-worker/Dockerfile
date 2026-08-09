FROM node:24.18.0-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.mjs job-functions.mjs ./

ENV NODE_ENV=production
USER node

CMD ["node", "server.mjs"]
