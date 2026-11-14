export const requireRole = (...roles) => (req, res, next) => {
  if (!req.session?.user || !roles.includes(req.session.user.role)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'No tienes permiso para esta operación.' },
    });
  }
  next();
};
