export const validateRequest = (schema, source = 'body') => (req, res, next) => {
  const parsed = schema.safeParse(req[source]);

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos enviados no son válidos.',
        details: parsed.error.flatten(),
      },
    });
  }

  req.validated = parsed.data;
  next();
};
