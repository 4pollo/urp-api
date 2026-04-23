import { InMemoryLoginAttemptStore } from './in-memory-login-attempt.store';

describe('InMemoryLoginAttemptStore', () => {
  let store: InMemoryLoginAttemptStore;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-23T00:00:00Z'));
    store = new InMemoryLoginAttemptStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getLockUntil', () => {
    it('returns null when there is no record', async () => {
      await expect(store.getLockUntil('user@example.com')).resolves.toBeNull();
    });

    it('returns null when record exists but is not locked', async () => {
      await store.incrementFailed('user@example.com');
      await expect(store.getLockUntil('user@example.com')).resolves.toBeNull();
    });

    it('returns the lock timestamp while still locked', async () => {
      const until = Date.now() + 60_000;
      await store.lock('user@example.com', until);

      await expect(store.getLockUntil('user@example.com')).resolves.toBe(until);
    });

    it('clears the record and returns null once lock has expired', async () => {
      const until = Date.now() + 60_000;
      await store.lock('user@example.com', until);

      jest.advanceTimersByTime(60_001);

      await expect(store.getLockUntil('user@example.com')).resolves.toBeNull();
      // 内部记录应已被清理：再次调用仍返回 null（验证 delete 副作用）
      await expect(store.getLockUntil('user@example.com')).resolves.toBeNull();
    });
  });

  describe('incrementFailed', () => {
    it('returns 1 on the first failure and starts a new window', async () => {
      await expect(store.incrementFailed('user@example.com')).resolves.toBe(1);
    });

    it('accumulates failures within the 5-minute window', async () => {
      await store.incrementFailed('user@example.com');
      jest.advanceTimersByTime(60_000); // 1 分钟后
      await store.incrementFailed('user@example.com');
      jest.advanceTimersByTime(60_000); // 再 1 分钟
      await expect(store.incrementFailed('user@example.com')).resolves.toBe(3);
    });

    it('resets the counter after the window expires', async () => {
      await store.incrementFailed('user@example.com');
      await store.incrementFailed('user@example.com');
      await store.incrementFailed('user@example.com');

      jest.advanceTimersByTime(5 * 60 * 1000 + 1);

      await expect(store.incrementFailed('user@example.com')).resolves.toBe(1);
    });

    it('keeps separate counters per email', async () => {
      await store.incrementFailed('a@example.com');
      await store.incrementFailed('a@example.com');
      await store.incrementFailed('b@example.com');

      await expect(store.incrementFailed('a@example.com')).resolves.toBe(3);
      await expect(store.incrementFailed('b@example.com')).resolves.toBe(2);
    });
  });

  describe('lock', () => {
    it('locks an email that already has failures', async () => {
      await store.incrementFailed('user@example.com');
      const until = Date.now() + 15 * 60 * 1000;
      await store.lock('user@example.com', until);

      await expect(store.getLockUntil('user@example.com')).resolves.toBe(until);
    });

    it('locks an email even when no prior record exists', async () => {
      const until = Date.now() + 15 * 60 * 1000;
      await store.lock('fresh@example.com', until);

      await expect(store.getLockUntil('fresh@example.com')).resolves.toBe(until);
    });

    it('overwrites a previous lockUntil with a later one', async () => {
      const first = Date.now() + 60_000;
      await store.lock('user@example.com', first);

      const extended = Date.now() + 30 * 60 * 1000;
      await store.lock('user@example.com', extended);

      await expect(store.getLockUntil('user@example.com')).resolves.toBe(extended);
    });
  });

  describe('clear', () => {
    it('removes failed counter so the next failure starts a fresh window', async () => {
      await store.incrementFailed('user@example.com');
      await store.incrementFailed('user@example.com');

      await store.clear('user@example.com');

      await expect(store.incrementFailed('user@example.com')).resolves.toBe(1);
    });

    it('removes an active lock', async () => {
      await store.lock('user@example.com', Date.now() + 60_000);

      await store.clear('user@example.com');

      await expect(store.getLockUntil('user@example.com')).resolves.toBeNull();
    });

    it('is a no-op for unknown emails', async () => {
      await expect(store.clear('ghost@example.com')).resolves.toBeUndefined();
    });
  });

  describe('integration: failure -> lock -> auto-expire -> fresh start', () => {
    it('walks through the full lifecycle', async () => {
      const email = 'user@example.com';

      // 累计 5 次失败
      for (let i = 0; i < 5; i++) {
        await store.incrementFailed(email);
      }

      // 触发锁定 15 分钟
      const lockUntil = Date.now() + 15 * 60 * 1000;
      await store.lock(email, lockUntil);
      await expect(store.getLockUntil(email)).resolves.toBe(lockUntil);

      // 锁定期内仍处于锁定状态
      jest.advanceTimersByTime(10 * 60 * 1000);
      await expect(store.getLockUntil(email)).resolves.toBe(lockUntil);

      // 锁定到期后自动解锁
      jest.advanceTimersByTime(5 * 60 * 1000 + 1);
      await expect(store.getLockUntil(email)).resolves.toBeNull();

      // 解锁后失败计数从 1 开始（之前的记录已被 getLockUntil 清理）
      await expect(store.incrementFailed(email)).resolves.toBe(1);
    });
  });
});
