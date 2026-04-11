FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json
RUN npm install

FROM node:20-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend
RUN npm run build -w @board-games/shared && npm run build -w @board-games/frontend

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages/frontend/dist ./packages/frontend/dist
COPY --from=build /repo/packages/frontend/package.json ./packages/frontend/package.json
EXPOSE 4173
CMD ["npm", "run", "preview", "-w", "@board-games/frontend"]
