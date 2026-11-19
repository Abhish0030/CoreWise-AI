import session from 'express-session';
import type { PrismaClient } from '@prisma/client';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    authExpiresAt?: number;
    agentId?: string;
  }
}

// express-session creates and signs IDs. This adapter only persists its server-side state.
export class PrismaSessionStore extends session.Store {
  constructor(private db: PrismaClient) {
    super();
  }
  get(id: string, callback: (error: unknown, value?: session.SessionData | null) => void) {
    void this.db.session
      .findUnique({ where: { id } })
      .then(async (record) => {
        if (!record) return null;
        if (record.expiresAt <= new Date()) {
          await this.db.session.deleteMany({ where: { id } });
          return null;
        }
        return JSON.parse(record.data) as session.SessionData;
      })
      .then((value) => callback(null, value), callback);
  }
  set(id: string, value: session.SessionData, callback?: (error?: unknown) => void) {
    const expiresAt = new Date(
      Math.min(
        value.cookie.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 3600000,
        value.authExpiresAt ?? Infinity,
      ),
    );
    const data = { data: JSON.stringify(value), userId: value.userId ?? null, expiresAt };
    void this.db.session
      .upsert({ where: { id }, create: { id, ...data }, update: data })
      .then(() => callback?.(), callback);
  }
  destroy(id: string, callback?: (error?: unknown) => void) {
    void this.db.session.deleteMany({ where: { id } }).then(() => callback?.(), callback);
  }
  // Sessions have an absolute expiry; reads never renew it.
  touch(_id: string, _value: session.SessionData, callback?: (error?: unknown) => void) {
    callback?.();
  }
}
