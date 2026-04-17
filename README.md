# URP API

基于 NestJS 构建的 RBAC 用户-角色-权限管理 API，提供认证、用户管理、角色管理、权限管理等 RESTful 接口。

## 技术栈

- NestJS
- TypeORM
- MySQL
- Passport + JWT
- class-validator

## 环境变量

复制 `.env.example` 为 `.env` 并按需填写：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=urp
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

## 开发命令

```bash
npm install
npm run start:dev
npm run build
npm run test
npm run test:e2e
npm run seed
```

## API 范围

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `GET /api/users`
- `GET /api/roles`
- `GET /api/permissions`

## Legacy demo

`public/demo/` 仍保留为 legacy 联调参考资源，不应视为正式前端交付物。
