# Stage 1: Build
FROM node:22-alpine AS builder
 
WORKDIR /app
 
RUN apk add --no-cache python3 make g++
 
COPY package*.json ./
RUN npm ci --legacy-peer-deps
 
COPY . .
 
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
 
RUN npm run build
 
# Stage 2: Production
FROM node:22-alpine
 
RUN npm install -g serve
 
WORKDIR /app
 
COPY --from=builder /app/dist ./dist
 
EXPOSE 3000
 
CMD ["serve", "-s", "/app/dist", "-l", "3000"]