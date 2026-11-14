# Luna Negra Joyas

Sitio corporativo y catálogo digital para joyería. No incluye carrito, pagos, checkout ni gestión de pedidos.

## Estado

Etapas 1–9: arquitectura, modelo relacional, API REST, autenticación segura, sitio público, catálogo dinámico, panel administrativo e integraciones de imágenes y contacto.

## Estructura

- `backend/`: API Express, validación Zod, servicios y Prisma.
- `frontend/`: sitio público, catálogo dinámico y panel administrativo.
- `docs/architecture.md`: arquitectura y límites de seguridad.
- `docs/data-model.md`: entidades, relaciones e integridad.
- `docs/api.md`: contrato REST disponible.

## Requisitos

- Node.js 20 o posterior
- PostgreSQL 14 o posterior
- npm

## Preparar el entorno local

1. Copia `backend/.env.example` como `backend/.env` y sustituye los valores de muestra. No uses las credenciales de ejemplo en producción.
2. Desde una cuenta administradora PostgreSQL, crea un usuario de migraciones propietario de la base y un usuario de aplicación con permisos solo de lectura/escritura:

```sql
CREATE ROLE luna_migrator LOGIN CREATEDB PASSWORD 'CAMBIA_ESTA_CLAVE';
CREATE ROLE luna_app LOGIN PASSWORD 'CAMBIA_ESTA_OTRA_CLAVE';
CREATE DATABASE lunanegra_dev OWNER luna_migrator;
\connect lunanegra_dev
GRANT CONNECT ON DATABASE lunanegra_dev TO luna_app;
GRANT USAGE ON SCHEMA public TO luna_app;
ALTER DEFAULT PRIVILEGES FOR ROLE luna_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO luna_app;
ALTER DEFAULT PRIVILEGES FOR ROLE luna_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO luna_app;
```

Configura `DATABASE_URL` con el usuario `luna_app` y `MIGRATION_DATABASE_URL` con `luna_migrator`. Codifica en percent-encoding los caracteres especiales de las contraseñas incluidas en una URL.
3. Instala dependencias y genera el cliente Prisma:

```powershell
cd backend
npm install
npm run prisma:generate
npm run prisma:validate
npm run prisma:deploy
npm run prisma:seed
npm run admin:create
```

Para desarrollo de esquema se puede usar `npm run prisma:migrate`; el rol de migraciones requiere `CREATEDB` para la base temporal que Prisma utiliza en `migrate dev`. En producción, `prisma migrate deploy` no necesita crear esa base temporal. La semilla crea roles y categorías de ejemplo de forma idempotente; no crea cuentas administrativas ni contraseñas.

`npm run admin:create` solicita nombre, correo, rol y contraseña en una terminal interactiva. La contraseña no se muestra y se almacena con Argon2id. No existe registro público de cuentas.

## Ejecutar y probar

```powershell
cd backend
npm run dev
```

En otra terminal, inicia el sitio:

```powershell
cd frontend
npm run dev
```

Abre `http://localhost:3000` para el sitio y `http://localhost:3000/admin.html` para el panel. El backend debe estar disponible en `http://localhost:4000` y la base de datos configurada; el panel requiere la cuenta creada con `npm run admin:create`. Verifica `GET http://localhost:4000/api/health`. Ejecuta las pruebas del backend desde `backend` con `npm test`.

### Instancia local de desarrollo de este equipo

La base de desarrollo usa un clúster PostgreSQL 17 separado en `%LOCALAPPDATA%\LunaNegraJoyas\postgres\data`, puerto `55473`, base `lunanegra_dev`. La configuración y secretos locales están en `backend/.env` y no se versionan. Si el equipo se reinicia, vuelve a iniciar PostgreSQL desde PowerShell:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "$env:LOCALAPPDATA\LunaNegraJoyas\postgres\data" -l "$env:LOCALAPPDATA\LunaNegraJoyas\postgres\postgres.log" -o "-p 55473 -h 127.0.0.1" start
```

Después inicia la API con `npm run dev` desde `backend`. La base contiene las categorías iniciales, pero aún no hay productos ni cuenta administrativa; crea una cuenta con `npm run admin:create` para ingresar al panel.

## Estado y verificación de las etapas 1–8

- `npm run prisma:validate` y `npm run prisma:generate`: correctos.
- Migración inicial y semilla: aplicadas correctamente en un PostgreSQL 17 temporal.
- Prueba integrada con roles separados de migrador y aplicación: CRUD, catálogo HTTP y registro de actividad correctos.
- Autenticación: sesiones PostgreSQL, cookies seguras, CSRF sincronizado, límite de intentos y contraseñas Argon2id.
- Autorización: ADMIN y EDITOR; gestión de cuentas solo para ADMIN, con invalidación de sesiones al cambiar rol o desactivar una cuenta.
- `npm test`: 11 pruebas pasan y 2 pruebas PostgreSQL se omiten sin integración; las 13 pasan con PostgreSQL de pruebas.
- `npm audit --audit-level=high`: 0 vulnerabilidades.
- Etapa 7: sitio adaptable a móviles, catálogo conectado a la API pública y panel para productos, categorías y cuentas.
- Etapa 8: panel protegido para administrar productos y categorías; permite editar, activar/desactivar y archivar productos, y restringe la gestión de cuentas al rol ADMIN.
- Etapa 9: carga y reemplazo de fotografías con validación de contenido y Cloudinary; canales públicos de WhatsApp y redes sociales configurables.

La carga acepta JPEG, PNG y WebP de hasta 5 MB por archivo y 20 fotografías por producto. Configura juntas `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` en `backend/.env`; si faltan, el panel deshabilita la carga. `WHATSAPP_PHONE` acepta un número internacional y se normaliza al formato requerido por `wa.me`. Instagram usa el perfil de referencia proporcionado; Facebook y TikTok aparecen al configurar sus URL HTTPS.

Para ejecutar las pruebas PostgreSQL integradas, configura las variables con una base de **pruebas**, aplica la migración y semilla los roles antes de ejecutar:

```powershell
$env:RUN_DATABASE_INTEGRATION = 'true'
$env:NODE_ENV = 'test'
node --import dotenv/config --test
Remove-Item Env:\RUN_DATABASE_INTEGRATION
Remove-Item Env:\NODE_ENV
```

La prueba crea y elimina datos temporales; no la ejecutes contra producción. No requiere `MIGRATION_DATABASE_URL` durante la ejecución de pruebas si la base ya está migrada.

## Variables de entorno

`DATABASE_URL` (usuario de aplicación), `MIGRATION_DATABASE_URL` (usuario de migraciones), `PORT`, `NODE_ENV`, `SESSION_SECRET`, `SESSION_COOKIE_NAME`, `TRUST_PROXY`, `ALLOWED_ORIGINS`, `FRONTEND_URL`, las credenciales de Cloudinary, `WHATSAPP_PHONE` y los enlaces sociales están en `backend/.env.example`. Las dos URLs permiten aplicar el principio de privilegio mínimo y cambiar a cualquier proveedor PostgreSQL compatible sin modificar el código o el esquema. En producción, usa HTTPS y configura `TRUST_PROXY=true` solo si la API está detrás de un proxy confiable que termina TLS.

## Respaldo y restauración local

```powershell
pg_dump --format=custom --file=lunanegra.backup --dbname="$env:DATABASE_URL"
pg_restore --clean --if-exists --dbname="$env:DATABASE_URL" lunanegra.backup
```

Antes de restaurar, confirma el destino: `--clean` reemplaza objetos existentes en la base destino. Para migrar a otro proveedor, crea allí la base y el usuario, actualiza `DATABASE_URL`, aplica `npm run prisma:deploy` y transfiere los datos con `pg_dump`/`pg_restore` según el procedimiento del proveedor.

## Etapas posteriores

La Etapa 10 queda para la ronda integral de pruebas, documentación final y preparación del despliegue.
