# Arquitectura de Luna Negra Joyas

## Alcance

Sitio corporativo y catálogo digital con panel de administración privado. No se implementan carrito, pagos, checkout ni gestión de pedidos.

## Componentes

```text
Navegador
  ├─ Sitio público (HTML5, CSS3, JavaScript, Bootstrap 5)
  └─ Panel administrativo (HTML5, CSS3, JavaScript, Bootstrap 5)
            │ HTTPS + API REST
            ▼
      Node.js + Express
       ├─ Rutas y controladores
       ├─ Validación y middleware de seguridad
       ├─ Servicios de aplicación
       └─ Prisma ORM
            ├─ PostgreSQL: catálogo, cuentas, sesiones y auditoría
            └─ Cloudinary: archivos de imagen
```

El frontend y el backend se mantienen separados. En producción se recomienda publicarlos bajo el mismo dominio, por ejemplo el frontend en `/` y la API en `/api`, detrás de un proxy HTTPS. El origen autorizado sigue definido por `ALLOWED_ORIGINS`.

Durante el desarrollo, `frontend/server.js` sirve los archivos estáticos en `http://localhost:3000` y se conecta a la API en `http://localhost:4000/api`. En producción, el frontend usa `/api` en el mismo origen; el hospedaje estático debe aplicar una política CSP equivalente a la del servidor local.

## Responsabilidades

- El catálogo público solo consulta productos activos, publicados y no eliminados.
- Las rutas administrativas requieren sesión y autorización por rol en el servidor; solo ADMIN puede gestionar cuentas.
- Prisma administra el acceso a PostgreSQL y las migraciones versionadas.
- Cloudinary almacena archivos; PostgreSQL conserva URL e identificadores públicos.
- Los secretos y conexiones se configuran mediante variables de entorno.
- El cliente Prisma usa `DATABASE_URL` con permisos de aplicación; las migraciones usan `MIGRATION_DATABASE_URL` con permisos DDL.

## Capas del backend

- `src/config`: configuración validada y clientes externos.
- `src/routes`: mapeo de endpoints.
- `src/controllers`: protocolo HTTP y serialización de respuestas.
- `src/services`: reglas de aplicación y operaciones Prisma.
- `src/middleware`: validación, autorización, límites y errores.
- `src/validators`: esquemas Zod para entradas.
- `src/auth`: autenticación, sesiones, cookies y protección CSRF.
- `src/utils`: utilidades pequeñas y compartidas.

El frontend sirve las páginas `index.html` y `admin.html`, con estilos y módulos JavaScript estáticos en `assets/`. El catálogo público consulta productos y categorías publicados; el panel consume las rutas autenticadas y no almacena credenciales ni tokens de sesión en almacenamiento local.

## Límites de seguridad implementados

Helmet con CSP restrictiva, CORS allowlist, límites de cuerpo y solicitudes, validación de entradas, consultas Prisma parametrizadas y límites para inicio de sesión. Las sesiones persistentes usan PostgreSQL; las cookies son HttpOnly y SameSite=Lax, y Secure en producción. CSRF sincronizado protege las operaciones mutantes. Argon2id almacena contraseñas, y los roles ADMIN/EDITOR se verifican en el servidor. El cambio de rol o la desactivación de una cuenta revoca sus sesiones; la gestión de cuentas queda auditada y solo está disponible para ADMIN.
