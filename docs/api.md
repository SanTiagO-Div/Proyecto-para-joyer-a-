# API REST (Etapas 5–8)

Base local: `http://localhost:4000/api`.

## Salud

- `GET /health`: confirma disponibilidad del proceso.

## Catálogo público

- `GET /public/contact`: canales de contacto públicos configurados, sin credenciales de servicios.
- `GET /public/products?page=1&limit=12&q=...&categoryId=...&availability=AVAILABLE`
- `GET /public/products/:slug`
- `GET /public/categories`

Las respuestas de productos incluyen `items` y metadatos `pagination`. Solo se devuelven productos publicados, activos y no eliminados. El precio se devuelve como `null` si el producto no permite mostrarlo.

## Administración

- `GET /admin/products`
- `POST /admin/products`
- `GET /admin/products/:id`
- `PATCH /admin/products/:id`
- `DELETE /admin/products/:id` (eliminación lógica)
- `GET /admin/uploads/status`
- `POST /admin/products/:id/images` (`multipart/form-data`, campo `image`)
- `DELETE /admin/products/:id/images/:imageId`
- `GET /admin/categories`
- `POST /admin/categories`

Todas las rutas requieren una sesión autenticada. ADMIN y EDITOR pueden consultar y gestionar productos y categorías. Las operaciones que cambian datos requieren el encabezado `x-csrf-token`.

El `PATCH /admin/products/:id` admite `isActive: false` para ocultar un producto sin archivarlo; se puede reactivar enviando `isActive: true`. `DELETE` lo archiva de forma lógica y lo excluye de las consultas administrativas habituales.

La carga de imágenes acepta un archivo JPEG, PNG o WebP de hasta 5 MB por solicitud, verifica los bytes del archivo y almacena en PostgreSQL solo la URL segura y los metadatos de Cloudinary. Cada producto admite hasta 20 imágenes. Las rutas requieren sesión, rol ADMIN o EDITOR y token CSRF para cambios; la carga tiene un límite adicional de solicitudes.

`GET /public/contact` expone únicamente `whatsappPhone` y enlaces sociales configurados. La API valida el formato del teléfono y restringe los enlaces sociales a HTTPS en sus dominios oficiales. Las credenciales de Cloudinary nunca se envían al navegador.

### Cuentas administrativas (solo ADMIN)

- `GET /admin/users?page=1&limit=20`
- `POST /admin/users` con `{ "name", "email", "password", "role": "ADMIN" | "EDITOR" }`
- `PATCH /admin/users/:id/role` con `{ "role": "ADMIN" | "EDITOR" }`
- `PATCH /admin/users/:id/status` con `{ "status": "ACTIVE" | "DISABLED" }`

La creación requiere una contraseña de al menos 12 caracteres. Las respuestas nunca incluyen el hash. No se permite cambiar el propio rol ni desactivar la propia cuenta; las sesiones del usuario se revocan al cambiar su rol o desactivarlo. Las acciones de gestión quedan registradas en la bitácora.

## Autenticación

- `GET /auth/csrf-token`: crea o devuelve un token CSRF sincronizado.
- `POST /auth/login` con `{ "email", "password" }` y `x-csrf-token`; el éxito devuelve usuario y un token rotado.
- `GET /auth/me`: devuelve la cuenta de la sesión actual.
- `POST /auth/logout` con `x-csrf-token`: destruye la sesión.

La cookie de sesión es HttpOnly, SameSite=Lax y dura ocho horas; Secure se activa en producción. Los intentos fallidos de inicio de sesión tienen límite por IP. Las contraseñas se almacenan con Argon2id y las respuestas de credenciales inválidas no revelan si una cuenta existe.

## Errores

Las respuestas de error usan `{ "error": { "code": "...", "message": "..." } }`. Los detalles internos y trazas no se envían al cliente. Las entradas inválidas reciben `400`; duplicados, `409`; recursos inexistentes, `404`.
