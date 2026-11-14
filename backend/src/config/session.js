import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;
const sessionPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
const PostgreSqlStore = connectPgSimple(session);

export const sessionMiddleware = session({
  name: env.SESSION_COOKIE_NAME,
  store: new PostgreSqlStore({
    pool: sessionPool,
    tableName: 'Session',
    schemaName: 'public',
    createTableIfMissing: false,
    pruneSessionInterval: 15 * 60,
  }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: false,
  proxy: env.TRUST_PROXY,
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  },
});

export const closeSessionPool = () => sessionPool.end();
