FROM node:22-slim AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM dependencies AS build
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
ENV HOST=0.0.0.0
ENV PORT=8080
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 8080
CMD ["node", "./dist/server/entry.mjs"]
