FROM node:20-slim

# System Chromium + fonts, so Puppeteer works the same on any Railway builder
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Use the system Chromium instead of downloading one during npm install
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js ./

# Don't run as root
USER node

CMD ["node", "index.js"]
