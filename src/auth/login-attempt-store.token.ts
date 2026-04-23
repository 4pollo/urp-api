/**
 * DI token for LoginAttemptStore，将实现类与消费者解耦。
 * 当前绑定 InMemoryLoginAttemptStore，未来可在 AuthModule 中替换为 Redis 实现。
 */
export const LOGIN_ATTEMPT_STORE = Symbol('LOGIN_ATTEMPT_STORE');
