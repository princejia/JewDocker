FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

# ---------- 依赖 ----------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# next/image 生产环境的图片优化依赖 sharp（musl 构建）
RUN npm i sharp

# ---------- 构建 ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next.config.mjs 的 remotePatterns 在构建期读取，图片域名需在此提供
ARG COS_PUBLIC_BASE_URL
ARG COS_BUCKET
ARG COS_REGION
ENV COS_PUBLIC_BASE_URL=$COS_PUBLIC_BASE_URL
ENV COS_BUCKET=$COS_BUCKET
ENV COS_REGION=$COS_REGION
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------- 运行 ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 图片优化缓存目录，挂成卷可在容器重建后保留
RUN mkdir -p .next/cache/images && chown -R nextjs:nodejs .next/cache

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
