FROM node:24-bookworm-slim AS build

WORKDIR /workspace
RUN npm install --global pnpm@10.33.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/miniapp/package.json ./apps/miniapp/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/platform/package.json ./packages/platform/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm -r build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /workspace/apps/miniapp

# Keep the workspace source and pnpm links: internal packages export their TS source.
COPY --from=build --chown=node:node /workspace /workspace
USER node
EXPOSE 3000
CMD ["node", "./node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]

