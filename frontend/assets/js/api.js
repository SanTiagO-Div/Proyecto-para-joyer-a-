const localDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  && window.location.port === '3000';
const apiBase = localDevelopment ? 'http://localhost:4000/api' : '/api';
let csrfToken = null;

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function getCsrfToken() {
  const response = await fetch(`${apiBase}/auth/csrf-token`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const result = await readResponse(response);
  if (typeof result?.csrfToken !== 'string') {
    throw new ApiError('El servidor no entregó el token de seguridad.', response.status, 'INVALID_CSRF');
  }
  csrfToken = result.csrfToken;
  return csrfToken;
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const normalizedMethod = method.toUpperCase();
  const headers = { Accept: 'application/json' };
  const options = {
    method: normalizedMethod,
    credentials: 'include',
    headers,
  };
  if (body !== undefined) {
    if (body instanceof FormData) {
      options.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod)) {
    headers['x-csrf-token'] = csrfToken || await getCsrfToken();
  }

  const response = await fetch(`${apiBase}${path}`, options);
  const result = await readResponse(response);
  if (typeof result?.csrfToken === 'string') csrfToken = result.csrfToken;
  if (normalizedMethod === 'POST' && path === '/auth/logout' && response.ok) csrfToken = null;
  return result;
}

async function readResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    throw new ApiError(
      result?.error?.message || 'No se pudo completar la solicitud.',
      response.status,
      result?.error?.code,
    );
  }
  return result;
}
