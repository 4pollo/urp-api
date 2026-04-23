/**
 * 登录失败计数与账号锁定的抽象存储。
 *
 * 当前实现：进程内 Map（仅适合单实例）。
 * 未来升级：替换为 Redis 实现以支持多实例横向扩展，接口保持不变。
 */
export interface LoginAttemptStore {
  /** 账号是否处于锁定状态，是则返回解锁时间戳 */
  getLockUntil(emailKey: string): Promise<number | null>;

  /** 记录一次失败，返回累计失败次数；达到阈值时由调用方决定是否调用 lock */
  incrementFailed(emailKey: string): Promise<number>;

  /** 锁定账号到指定时间戳 */
  lock(emailKey: string, until: number): Promise<void>;

  /** 登录成功时清空失败计数与锁定状态 */
  clear(emailKey: string): Promise<void>;
}
