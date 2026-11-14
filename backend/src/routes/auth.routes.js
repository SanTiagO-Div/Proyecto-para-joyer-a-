import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { csrfProtection } from '../auth/csrf.js';
import {
  getCsrfToken,
  getCurrentUser,
  login,
  logout,
} from '../controllers/authController.js';
import { requireAuthentication } from '../middleware/requireAuthentication.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginSchema } from '../validators/authValidator.js';

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

router.get('/csrf-token', getCsrfToken);
router.post('/login', loginLimiter, csrfProtection, validateRequest(loginSchema), login);
router.get('/me', requireAuthentication, getCurrentUser);
router.post('/logout', csrfProtection, requireAuthentication, logout);

export { router as authRouter };
