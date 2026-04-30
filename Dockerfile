# syntax=docker/dockerfile:1

# 多阶段构建：Next.js 16 + Prisma + SQLite

FROM node:20-alpine AS base

# 安装 OpenSSL（Prisma 必需）
RUN apk add --no-cache openssl

WORKDIR /app

# ---- 依赖阶段 ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---- 构建阶段 ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 构建 Next.js（standalone 输出）
RUN npm run build

# ---- 运行阶段 ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

WORKDIR /app

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制 standalone 输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# 确保数据目录存在且可写
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

# 启动时自动运行迁移，然后启动服务
CMD npx prisma migrate deploy --schema=./prisma/schema.prisma && node server.js
