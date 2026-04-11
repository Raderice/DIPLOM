FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json ./
COPY package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/backend/package.json ./packages/backend/package.json
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /repo
RUN apk add --no-cache openssl
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/package.json ./package.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend
RUN npm run build --prefix packages/shared && npm run prisma:generate --prefix packages/backend && npm run build --prefix packages/backend

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/packages/backend/dist ./packages/backend/dist
COPY --from=build /repo/packages/backend/prisma ./packages/backend/prisma
COPY --from=build /repo/packages/backend/package.json ./packages/backend/package.json
EXPOSE 4000
CMD ["node", "packages/backend/dist/index.js"]
