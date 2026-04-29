FROM node:20-bullseye-slim

WORKDIR /app

# Install required build/runtime packages for canvas, sharp and sqlite
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
      pkg-config \
      libcairo2-dev \
      libpango1.0-dev \
      libglib2.0-dev \
      libjpeg-dev \
      libgif-dev \
      libwebp-dev \
      libvips-dev \
      libsqlite3-dev \
      sqlite3 && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --production && npm rebuild sqlite3 --build-from-source

COPY . .

RUN mkdir -p public/uploads public/feed_uploads public/game_uploads

EXPOSE 3000
CMD ["node", "server.js"]
