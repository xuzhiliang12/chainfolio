FROM node:26.7-alpine

ARG VERSION=dev
LABEL org.opencontainers.image.title="Chainfolio" \
      org.opencontainers.image.description="Self-hosted, watch-only multi-chain asset manager" \
      org.opencontainers.image.source="https://github.com/xuzhiliang12/chainfolio" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.version="$VERSION"

WORKDIR /app

COPY server.mjs ./
COPY public ./public

RUN mkdir -p /app/data && chown -R node:node /app

USER node

ENV HOST=0.0.0.0
ENV PORT=4173
ENV APP_VERSION=$VERSION

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173/api/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
