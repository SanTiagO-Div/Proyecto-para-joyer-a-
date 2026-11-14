import { authService } from '../auth/authService.js';
import { generateCsrfToken } from '../auth/csrf.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const sessionOperation = (req, operation) => new Promise((resolve, reject) => {
  req.session[operation]((error) => (error ? reject(error) : resolve()));
});

const saveSession = (req) => new Promise((resolve, reject) => {
  req.session.save((error) => (error ? reject(error) : resolve()));
});

export const getCsrfToken = asyncHandler(async (req, res) => {
  const csrfToken = generateCsrfToken(req);
  await saveSession(req);
  res.json({ csrfToken });
});

export const login = asyncHandler(async (req, res) => {
  const user = await authService.authenticate(req.validated.email, req.validated.password);
  if (!user) {
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' },
    });
  }

  await sessionOperation(req, 'regenerate');
  req.session.user = user;
  const csrfToken = generateCsrfToken(req, true);
  await saveSession(req);

  res.json({ user, csrfToken });
});

export const getCurrentUser = (req, res) => {
  res.json({ user: req.session.user });
};

export const logout = asyncHandler(async (req, res) => {
  await sessionOperation(req, 'destroy');
  res.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.status(204).end();
});
