FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json ./
COPY package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /repo
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/package.json ./package.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend
RUN npm run build --prefix packages/shared && npm run build --prefix packages/frontend

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages/frontend/dist ./packages/frontend/dist
COPY --from=build /repo/packages/frontend/package.json ./packages/frontend/package.json
EXPOSE 4173
CMD ["npm", "run", "preview", "--prefix", "packages/frontend"]
