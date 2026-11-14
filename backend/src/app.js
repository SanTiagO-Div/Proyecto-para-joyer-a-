import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env, allowedOrigins } from './config/env.js';
import { helmetConfig } from './config/security.js';
import { adminRouter } from './routes/admin.routes.js';
import { publicRouter } from './routes/public.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.routes.js';
import { sessionMiddleware } from './config/session.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);
app.use(helmet(helmetConfig));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(sessionMiddleware);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'luna-negra-joyas-api', environment: env.NODE_ENV });
});

app.use('/api/public', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
}), publicRouter);

app.use('/api/auth', authRouter);
app.use('/api/admin', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
}), adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    console.log(`Luna Negra Joyas API disponible en el puerto ${env.PORT}`);
  });
}
