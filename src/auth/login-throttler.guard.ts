import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * 按账号 email 限流的 Guard：
 * - 失败/成功都计入（防御性更高）
 * - email 缺失时退化为按 IP（如 body 解析前的预检请求）
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const email = (req.body as { email?: unknown })?.email;
    if (typeof email === 'string' && email.trim().length > 0) {
      return `login:${email.trim().toLowerCase()}`;
    }
    return `login-ip:${req.ip ?? 'unknown'}`;
  }
}
