import '../../scripts/runtime-environment.mjs';
import { createApp } from './app.js';
import { db } from './lib/db.js';

const port = Number(process.env.PORT ?? 4000);
const server = createApp().listen(port, process.env.HOST ?? '127.0.0.1', () => {
  console.info(`CoreWise API listening on http://${process.env.HOST ?? '127.0.0.1'}:${port}`);
});
const cleanup = setInterval(
  () => {
    void db.session
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => console.error('Session cleanup failed'));
  },
  60 * 60 * 1000,
);
cleanup.unref();
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    clearInterval(cleanup);
    server.close(() => {
      void db.$disconnect().finally(() => process.exit(0));
    });
  });
}
