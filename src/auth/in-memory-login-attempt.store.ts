import { Injectable } from '@nestjs/common';
import { LoginAttemptStore } from './login-attempt-store.interface';

interface Record {
  count: number;
  lockUntil?: number;
  /** 失败计数的起始时间，用于实现滑动窗口 */
  windowStart: number;
}

/**
 * 进程内实现，仅适合单实例部署。
 *
 * 失败窗口：5 分钟内的失败次数累计，超过窗口自动重置；
 * 锁定时长：15 分钟；
 * 阈值：10 次失败触发锁定。
 */
@Injectable()
export class InMemoryLoginAttemptStore implements LoginAttemptStore {
  private readonly records = new Map<string, Record>();
  private readonly windowMs = 5 * 60 * 1000;

  async getLockUntil(emailKey: string): Promise<number | null> {
    const record = this.records.get(emailKey);
    if (!record?.lockUntil) return null;
    if (record.lockUntil <= Date.now()) {
      // 锁定已过期，顺便清理
      this.records.delete(emailKey);
      return null;
    }
    return record.lockUntil;
  }

  async incrementFailed(emailKey: string): Promise<number> {
    const now = Date.now();
    const existing = this.records.get(emailKey);
    if (!existing || now - existing.windowStart > this.windowMs) {
      this.records.set(emailKey, { count: 1, windowStart: now });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }

  async lock(emailKey: string, until: number): Promise<void> {
    const existing = this.records.get(emailKey);
    if (existing) {
      existing.lockUntil = until;
    } else {
      this.records.set(emailKey, {
        count: 0,
        lockUntil: until,
        windowStart: Date.now(),
      });
    }
  }

  async clear(emailKey: string): Promise<void> {
    this.records.delete(emailKey);
  }
}
