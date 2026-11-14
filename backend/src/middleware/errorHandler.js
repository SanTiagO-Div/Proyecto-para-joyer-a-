export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Ruta no encontrada.' },
  });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error?.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: { code: 'CSRF_INVALID', message: 'La solicitud no superó la validación de seguridad.' },
    });
  }
  if ([400, 409, 413, 503].includes(error?.statusCode) && error.expose === true) {
    return res.status(error.statusCode).json({
      error: {
        code: {
          400: 'INVALID_REQUEST',
          409: 'CONFLICT',
          413: 'PAYLOAD_TOO_LARGE',
          503: 'SERVICE_UNAVAILABLE',
        }[error.statusCode],
        message: error.message,
      },
    });
  }
  if (error?.code === 'P2034') {
    return res.status(409).json({
      error: { code: 'CONCURRENT_UPDATE', message: 'La cuenta cambió simultáneamente. Intenta de nuevo.' },
    });
  }
  if (error?.code === 'P2002') {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'Ya existe un registro con esos datos.' },
    });
  }
  if (error?.code === 'P2025') {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Registro no encontrado.' },
    });
  }
  if (error?.code === 'P2003') {
    return res.status(400).json({
      error: { code: 'INVALID_REFERENCE', message: 'La referencia indicada no es válida.' },
    });
  }

  console.error(error);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' },
  });
};
