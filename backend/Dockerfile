# Stage 1: Build
FROM node:22-alpine AS builder
 
WORKDIR /app
 
COPY package*.json ./
RUN npm ci
 
COPY . .
RUN npm run build
 
# Stage 2: Production
FROM node:22-alpine
 
WORKDIR /app
 
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
 
ARG AZURE_KEY_VAULT_NAME
ENV AZURE_KEY_VAULT_NAME=${AZURE_KEY_VAULT_NAME}

ARG ENABLE_TEST_FRAMEWORK=false
ENV ENABLE_TEST_FRAMEWORK=${ENABLE_TEST_FRAMEWORK}

EXPOSE 3001

CMD ["node", "dist/index.js"]