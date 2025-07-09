FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
FROM base AS deps
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Add non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Set user
USER nodejs

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/api/v1/health', (res) => res.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start the application
CMD ["node", "dist/server.js"]