FROM node:20-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package.json backend/package-lock.json ./

# Install all dependencies (including dev for tsc)
RUN npm ci

# Copy backend source
COPY backend/ .

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev

EXPOSE 3001

CMD ["node", "dist/index.js"]
