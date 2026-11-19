import { Router, type Request, type RequestHandler } from 'express';
import session from 'express-session';
import { csrfSync } from 'csrf-sync';
import argon2 from 'argon2';
import { rateLimit } from 'express-rate-limit';
import { Prisma } from '@prisma/client';
import {
  registerSchema,
  loginSchema,
  profileUpdateSchema,
  userResponseSchema,
  csrfResponseSchema,
} from '@corewise/types';
import { db } from '../../lib/db.js';
import { ApiError, validate } from '../../lib/errors.js';
import { PrismaSessionStore } from './session-store.js';

const sessionLifetime = 8 * 60 * 60 * 1000;
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  defaultProfileId: true,
  selectedProfileId: true,
} as const;
const csrf = csrfSync();
export const invalidCsrfTokenError = csrf.invalidCsrfTokenError;
export const requireUser: RequestHandler = async (req, _res, next) => {
  if (!req.session.userId || !req.session.authExpiresAt || req.session.authExpiresAt <= Date.now())
    return next(new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.'));
  const user = await db.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true },
  });
  if (!user) return next(new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.'));
  next();
};
export function sessionMiddleware() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('replace-with-'))
    throw new Error('SESSION_SECRET must contain at least 32 random characters. See .env.example.');
  const production = process.env.NODE_ENV === 'production';
  if (production && !process.env.APP_ORIGIN?.startsWith('https://'))
    throw new Error('Production APP_ORIGIN must use HTTPS.');
  return session({
    name: production ? '__Host-corewise.sid' : 'corewise.sid',
    secret,
    store: new PrismaSessionStore(db),
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      path: '/',
      maxAge: sessionLifetime,
    },
  });
}

function save(req: Request) {
  return new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve())),
  );
}
async function establish(req: Request, userId: string) {
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve())),
  );
  req.session.userId = userId;
  req.session.authExpiresAt = Date.now() + sessionLifetime;
  csrf.generateToken(req);
  await save(req);
}
function serializeUser(user: { createdAt: Date }) {
  return userResponseSchema.parse({ data: { ...user, createdAt: user.createdAt.toISOString() } });
}
// A real Argon2 hash keeps nonexistent-user checks on the password-verification path.
const dummyHash = argon2.hash('not-a-real-account-password', {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
});

export function authRoutes() {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(sessionMiddleware());
  router.get('/auth/csrf', async (req, res) => {
    const token = csrf.generateToken(req);
    await save(req);
    res.json(csrfResponseSchema.parse({ data: { token } }));
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication attempts. Try again in 15 minutes.',
      },
    },
  });
  router.use('/auth/register', authLimit);
  router.use('/auth/login', authLimit);
  router.use((req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      const expected = process.env.APP_ORIGIN ?? 'http://127.0.0.1:3000';
      if ((origin && origin !== expected) || req.get('sec-fetch-site') === 'cross-site')
        return next(new ApiError(403, 'CSRF_INVALID', 'Request origin is not allowed.'));
    }
    next();
  });
  router.use(csrf.csrfSynchronisedProtection);
  router.post('/auth/register', validate(registerSchema), async (req, res) => {
    const input = registerSchema.parse(req.body);
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    try {
      const user = await db.user.create({
        data: { name: input.name, email: input.email, passwordHash },
        select: publicUserSelect,
      });
      await establish(req, user.id);
      res.status(201).json(serializeUser(user));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        throw new ApiError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
      throw err;
    }
  });
  router.post('/auth/login', validate(loginSchema), async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const valid = await argon2.verify(user?.passwordHash ?? (await dummyHash), input.password);
    if (!user || !valid)
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    await establish(req, user.id);
    res.json(serializeUser(user));
  });
  router.get('/auth/me', requireUser, async (req, res) => {
    const user = await db.user.findUniqueOrThrow({
      where: { id: req.session.userId! },
      select: publicUserSelect,
    });
    res.json(serializeUser(user));
  });
  router.post('/auth/logout', requireUser, async (req, res) => {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((err) => (err ? reject(err) : resolve())),
    );
    res.clearCookie(
      process.env.NODE_ENV === 'production' ? '__Host-corewise.sid' : 'corewise.sid',
      { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' },
    );
    res.status(204).end();
  });
  router.patch('/account', requireUser, validate(profileUpdateSchema), async (req, res) => {
    const user = await db.user.update({
      where: { id: req.session.userId! },
      data: profileUpdateSchema.parse(req.body),
      select: publicUserSelect,
    });
    res.json(serializeUser(user));
  });
  return router;
}
