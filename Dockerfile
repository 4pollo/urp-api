# 多阶段构建：第一阶段编译 TypeScript，第二阶段只保留运行时所需文件
FROM node:20-alpine AS builder

WORKDIR /app

# 优先复制依赖描述文件，最大化利用层缓存
COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build \
  && npm prune --omit=dev

# ---- 运行阶段 ----
FROM node:20-alpine AS runner

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# 仅复制运行时必须的产物
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# 静态资源（如 main.ts 中通过 useStaticAssets 引用了 public/）
COPY public ./public

# 非 root 用户运行
RUN addgroup -S app && adduser -S app -G app \
  && chown -R app:app /app
USER app

EXPOSE 3000

# 健康检查依赖任务 14 的 /health 端点（如未实现可改为根路径 /）
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

CMD ["node", "dist/main"]
