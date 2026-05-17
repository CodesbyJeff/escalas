FROM node:20-alpine AS base
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-schemas/package.json packages/shared-schemas/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @escalas/backend exec prisma generate
RUN pnpm --filter @escalas/backend build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
COPY --from=build /repo/node_modules /app/node_modules
COPY --from=build /repo/apps/backend/dist /app/dist
COPY --from=build /repo/apps/backend/prisma /app/prisma
COPY --from=build /repo/apps/backend/package.json /app/package.json
COPY --from=build /repo/packages /app/packages
EXPOSE 3000
CMD ["node", "dist/server.js"]
