FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/build ./build
USER node

# stdio server: run with `docker run -i --rm -e FUTUUR_PUBLIC_KEY -e FUTUUR_PRIVATE_KEY <image>`
ENTRYPOINT ["node", "build/index.js"]
