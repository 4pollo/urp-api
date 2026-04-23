# URP API

基于 NestJS 的 **用户-角色-权限（RBAC）** 后端服务，提供认证、用户/角色/权限管理、菜单配置等 RESTful 接口，可作为独立的权限中心或与前端管理台（如 [`urp-web-nuxt`](../urp-web-nuxt)）配套使用。

> 本仓库当前版本为 `0.0.1`，文档与项目分析详见 [`docs/project-analysis.md`](./docs/project-analysis.md)。

---

## 目录

- [特性](#特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [目录结构](#目录结构)
- [常用命令](#常用命令)
- [API 概览](#api-概览)
- [部署](#部署)
- [测试](#测试)
- [安全说明](#安全说明)
- [License](#license)

---

## 特性

- **认证体系** — JWT Access/Refresh 双 Token，Refresh Token 旋转 + bcrypt 哈希存储
- **RBAC** — 用户 ↔ 角色 ↔ 权限三层模型；`@RequireRoles` / `@RequirePermissions` 装饰器声明端点要求
- **系统角色保护** — `SuperAdmin` / `Guest` 内置不可删；最后一位 `SuperAdmin` 不可被移除；不可自删 / 自冻结
- **登录速率限制 + 账号锁定** — 双维度限流（按账号 + 按 IP），10 次失败锁 15 分钟，登录成功立即清零；`@nestjs/throttler` 全局兜底
- **结构化审计日志** — 登录成功/失败/锁定触发/账号冻结等关键事件均带 `email` + `ip` + `attempt` 上下文
- **菜单配置内置于权限** — 权限可附带 `menuLabel/menuPath/menuIcon/menuOrder`，前端通过 `GET /api/permissions/menu` 拿到当前用户可见菜单
- **统一响应** — 全局拦截器输出 `{ code, data, message }`；全局异常过滤器映射 HTTP 状态到业务码
- **Swagger 文档** — 启动后访问 `/docs` 即可查看完整 API 与字段约束
- **健康检查** — `GET /health` 通过 `@nestjs/terminus` 探测数据库连通性
- **100 个单元测试** — 覆盖认证、RBAC、限流锁定、菜单配置等核心路径

---

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | NestJS 11 |
| 运行时 | Node.js 20+ |
| 语言 | TypeScript 5（启用 `strict` 三大开关） |
| ORM / DB | TypeORM 0.3 + MySQL 8（snake_case 命名策略） |
| 认证 | Passport + `passport-jwt` + bcrypt |
| 限流 | `@nestjs/throttler`（自定义 `LoginThrottlerGuard` 按账号 tracker） |
| 文档 | `@nestjs/swagger` |
| 测试 | Jest 30 + Supertest |

---

## 快速开始

### 0. 准备环境

- Node.js ≥ 20
- npm ≥ 10（或 pnpm / yarn）
- MySQL ≥ 8（开发期可用 Docker 一键启）

```bash
# 可选：本地起一个 MySQL
docker run -d --name urp-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=urp \
  mysql:8
```

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 然后按需修改 .env（详见下文「环境变量」）
```

> 注意：`JWT_SECRET` 必须 ≥16 字符；`DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` 缺失时应用启动会立即失败。

### 3. 初始化数据库

`synchronize: true` 在非生产环境会自动建表。首次启动后跑一次 seed 脚本创建系统角色、权限和管理员账号：

```bash
npm run seed
```

输出示例：

```
Created SuperAdmin role
Created Guest role
Ensured 11 base permissions exist
Assigned all permissions to SuperAdmin
Created admin user: admin@example.com
============================================================
IMPORTANT: Generated initial admin password:
  3f9c7a2e1b4d8e6f9a2c5d7e1f4a8b3c
Please change this password immediately after first login.
Set ADMIN_DEFAULT_PASSWORD in .env to use a custom password.
============================================================
```

> 如需自定义初始密码，在 `.env` 中设置 `ADMIN_DEFAULT_PASSWORD=your-strong-password` 后再运行 `npm run seed`。

### 4. 启动开发服务

```bash
npm run start:dev
```

访问：

- API 根：http://localhost:3001
- Swagger 文档：http://localhost:3001/docs
- 健康检查：http://localhost:3001/health

---

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|:---:|---|---|
| `DB_HOST` | – | `localhost` | MySQL 主机 |
| `DB_PORT` | – | `3306` | MySQL 端口 |
| `DB_USERNAME` | 是 | – | MySQL 用户名 |
| `DB_PASSWORD` | 是 | – | MySQL 密码 |
| `DB_DATABASE` | 是 | – | 数据库名 |
| `JWT_SECRET` | 是 | – | JWT 签名密钥，**必须 ≥ 16 字符** |
| `JWT_ACCESS_EXPIRES` | – | `15m` | Access Token 有效期 |
| `JWT_REFRESH_EXPIRES` | – | `7d` | Refresh Token 有效期 |
| `PORT` | – | `3000` | HTTP 端口 |
| `CORS_ORIGIN` | – | `http://localhost:3000` | 允许的前端来源；生产环境务必设置 |
| `NODE_ENV` | – | `development` | 设为 `production` 时关闭 `synchronize` 与详细错误日志 |
| `ADMIN_DEFAULT_PASSWORD` | – | 自动生成 | seed 脚本首次创建管理员的密码；留空时随机生成并打印 |

---

## 目录结构

```
src/
├── auth/                 # 认证、限流、账号锁定、Guard、策略、权限装饰器
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── access.guard.ts
│   ├── login-throttler.guard.ts
│   ├── in-memory-login-attempt.store.ts
│   └── system-roles.ts
├── users/                # 用户 CRUD、状态管理、角色分配
├── roles/                # 角色 CRUD、权限分配
├── permissions/          # 权限 CRUD、菜单配置、权限校验
├── health/               # /health 端点
├── common/
│   ├── dto/              # PaginationDto、TrimmedString 装饰器
│   ├── filters/          # 全局异常过滤器
│   └── interceptors/     # 全局响应包装拦截器
├── app.module.ts
├── main.ts
└── seed.ts               # 初始化系统角色、权限、管理员账号
docs/
└── project-analysis.md   # 项目分析、改进方案、实施进度
test/                     # E2E 测试
Dockerfile                # 多阶段构建
.dockerignore
```

---

## 常用命令

```bash
# 开发
npm run start:dev          # watch 模式
npm run start:debug        # 带 inspector

# 构建与运行
npm run build              # 编译到 dist/
npm run start:prod         # 运行编译产物（NODE_ENV=production）

# 数据
npm run seed               # 初始化系统角色 / 权限 / 管理员

# 质量
npm run lint               # ESLint
npm run format             # Prettier
npm test                   # 单元测试（100 个用例）
npm run test:cov           # 覆盖率报告
npm run test:e2e           # E2E 测试
```

---

## API 概览

> 完整 OpenAPI 文档在启动后通过 `/docs` 访问，下表仅列主要端点。

### 认证 (`/api/auth`)

| 方法 | 路径 | 限流 | 说明 |
|---|---|---|---|
| POST | `/register` | 1h / 5 | 注册（默认分配 Guest 角色） |
| POST | `/login` | 5min / 10（按账号） | 登录；10 次失败锁 15 分钟 |
| POST | `/refresh` | 1min / 60 | 刷新 Access Token |
| POST | `/logout` | – | 清空 Refresh Token |
| POST | `/change-password` | 1h / 10 | 修改密码（旧密码必须不同于新密码） |
| GET  | `/me` | – | 当前用户信息（含角色） |

### 用户 (`/api/users`)

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET    | `/` | `user:read` | 分页查询（支持 status/roleId/email 模糊搜索） |
| GET    | `/:id` | `user:read` | 用户详情 |
| POST   | `/` | `user:write` | 创建用户 |
| PUT    | `/:id` | `user:write` | 更新基础信息 |
| DELETE | `/:id` | `user:delete` | 删除用户（SuperAdmin 不可自删） |
| PATCH  | `/:id/status` | `user:update-status` | 激活 / 冻结 |
| PUT    | `/:id/roles` | `SuperAdmin` | 分配角色（保护最后一位 SuperAdmin） |

### 角色 (`/api/roles`)

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET    | `/` | `role:read` | 分页查询 |
| GET    | `/:id` | `role:read` | 角色详情（含权限列表） |
| POST   | `/` | `role:write` | 创建角色 |
| PUT    | `/:id` | `role:write` | 更新角色（系统角色不可改） |
| DELETE | `/:id` | `role:delete` | 删除角色（系统角色不可删） |
| PUT    | `/:id/permissions` | `SuperAdmin` | 分配权限（系统角色不可改） |

### 权限 (`/api/permissions`)

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET    | `/permissions` | `permission:read` | 分页查询 |
| GET    | `/permissions/:id` | `permission:read` | 权限详情 |
| POST   | `/permissions` | `SuperAdmin` | 创建权限 |
| PUT    | `/permissions/:id` | `SuperAdmin` | 更新权限（系统权限仅菜单字段可改） |
| DELETE | `/permissions/:id` | `SuperAdmin` | 删除权限（系统权限不可删） |
| GET    | `/permissions/me` | – | 当前用户的所有权限和角色 |
| GET    | `/permissions/menu` | – | 当前用户可见的菜单项（基于 `showInMenu` + 权限） |
| POST   | `/check` | – | 检查当前用户是否拥有指定权限 key |

### 健康

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 数据库连通性探针 |

---

## 部署

### 方式一：Docker（推荐）

仓库已附带多阶段构建的 [`Dockerfile`](./Dockerfile)：

```bash
# 构建镜像
docker build -t urp-api:latest .

# 运行（连本机 MySQL）
docker run -d --name urp-api \
  --add-host=host.docker.internal:host-gateway \
  -p 3000:3000 \
  -e DB_HOST=host.docker.internal \
  -e DB_USERNAME=root \
  -e DB_PASSWORD=root \
  -e DB_DATABASE=urp \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -e CORS_ORIGIN=https://your-frontend.example.com \
  -e NODE_ENV=production \
  urp-api:latest
```

镜像特点：
- Alpine + Node 20，最终镜像 ~150MB
- 使用非 root 用户 `app` 运行
- 内置 `HEALTHCHECK` 调用 `/health`
- 已剔除 devDependencies，仅保留运行时

#### docker-compose 示例

```yaml
services:
  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: urp
    volumes: [mysql-data:/var/lib/mysql]
    ports: ["3306:3306"]

  api:
    build: .
    depends_on: [mysql]
    environment:
      DB_HOST: mysql
      DB_USERNAME: root
      DB_PASSWORD: root
      DB_DATABASE: urp
      JWT_SECRET: change-me-to-a-32-char-random-secret
      CORS_ORIGIN: https://your-frontend.example.com
      NODE_ENV: production
    ports: ["3000:3000"]

volumes:
  mysql-data:
```

### 方式二：直接运行编译产物

```bash
npm ci --omit=dev
npm run build
NODE_ENV=production node dist/main
```

建议配合进程管理器（PM2 / systemd）运行。

### 部署清单

部署到生产前请确认：

- [ ] `JWT_SECRET` 替换为强随机字符串（≥32 字符建议 `openssl rand -hex 32`）
- [ ] `ADMIN_DEFAULT_PASSWORD` 设置或运行 seed 后立即修改默认密码
- [ ] `NODE_ENV=production`（关闭 `synchronize`，避免误改表结构）
- [ ] `CORS_ORIGIN` 指向真实前端域名
- [ ] 数据库已通过外部工具完成 schema 迁移（生产模式下应用不会自动建表）
- [ ] 反向代理（Nginx / Traefik）启用 HTTPS 并正确转发 `X-Forwarded-For`（限流按 IP 兜底依赖此 header）
- [ ] 配置外部日志收集（应用以 NestJS Logger + JSON-able 上下文输出审计事件）

> **多实例部署注意**：当前账号锁定使用进程内 `Map` 存储，仅适合**单实例**。多实例需将 `LoginAttemptStore` 替换为 Redis 实现（接口已抽象，详见 `docs/project-analysis.md` 第 3.5 节）。

---

## 测试

```bash
npm test                   # 12 个套件 / 100 个测试
npm run test:cov           # 生成 coverage 报告
npm run test:e2e           # E2E（需可用数据库）
```

测试覆盖的关键路径：
- 认证流：注册 / 登录 / Token 旋转 / 改密 / 冻结账号拒登
- 限流锁定：失败计数 / 达阈值锁定 / 锁定期拒登 / 成功清零 / 滑动窗口 / 自动解锁
- RBAC：权限 Guard / SuperAdmin 旁路 / 系统权限保护 / 菜单配置一致性
- DTO 校验：菜单字段必填 / 权限 key 格式 / 密码长度等

---

## 安全说明

- 密码：bcrypt 12 轮，DTO 强制 `@MaxLength(72)`（bcrypt 内部截断阈值）防止 DoS
- Refresh Token：bcrypt 哈希存储 + 每次刷新旋转 + 改密/状态变更全部失效
- SQL 注入：全部使用 TypeORM 参数化查询
- XSS：API 不渲染前端模板；统一响应包装
- 限流：登录按账号 + 全局按 IP 双兜底
- 审计：登录成功/失败/锁定触发/账号冻结/锁定期拒登 五类结构化日志

详细安全分析与改进路线图见 [`docs/project-analysis.md`](./docs/project-analysis.md)。

---

## License

[MIT](./LICENSE)
