FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run typecheck && npm run build:web \
  && cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs dist/web/assets/maplibre-gl-worker.mjs \
  && cp node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs dist/web/assets/maplibre-gl-shared.mjs \
  && cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs dist/web/assets/maplibre-gl-worker.js

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends iputils-ping traceroute \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/dist ./dist

EXPOSE 5174
USER node
CMD ["npm", "run", "start"]
