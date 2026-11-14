export const requireAuthentication = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Se requiere iniciar sesión.' },
    });
  }
  next();
};
