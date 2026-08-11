FROM node:24.18.0-bookworm-slim

WORKDIR /app/ops/security-worker

COPY ops/security-worker/package.json ops/security-worker/package-lock.json ./
RUN npm ci --omit=dev

COPY ops/security-worker/server.mjs ops/security-worker/job-functions.mjs ./
COPY src/lib/payment/fingerprintIdentity.mjs /app/src/lib/payment/fingerprintIdentity.mjs

ENV NODE_ENV=production
USER node

CMD ["node", "server.mjs"]
