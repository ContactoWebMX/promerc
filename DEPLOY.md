# Despliegue en cPanel (Setup Node.js App)

## Antes de empezar

- Base de datos PostgreSQL creada desde cPanel (anota usuario, contraseña, nombre de base).
- Una cuenta de correo (o SMTP externo) para el envío de recuperación de contraseña.
- Acceso a Terminal/SSH en cPanel — `argon2` usa un binario nativo, así que
  **`npm install` y `npm run build` deben correr en el propio servidor de
  cPanel**, no copiarse desde otra máquina (el binario compilado en tu
  laptop puede no ser compatible con el Node/CPU del hosting).

## 1. Subir el código

Sube el repositorio completo (o clónalo por git) a una carpeta fuera de
`public_html`, por ejemplo `/home/usuario/promerc-src`. Esa carpeta es solo
el origen — no es lo que cPanel va a ejecutar.

## 2. Configurar variables de entorno

En **cPanel → Setup Node.js App → tu aplicación → Environment Variables**,
carga los valores de `.env.production.example` (referencia, no se sube tal
cual — cada valor se captura en la UI de cPanel). Como mínimo:
`DATABASE_URL`, `SESSION_SECRET`, `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`,
`APP_URL`, `STORAGE_ROOT`, `NODE_ENV=production`.

`STORAGE_ROOT` debe ser una ruta persistente FUERA de la carpeta de build
(ej. `/home/usuario/promerc-storage`) — esa carpeta guarda las fotos y
firmas subidas y nunca debe borrarse entre despliegues.

## 3. Instalar, migrar y construir (en la Terminal de cPanel)

```bash
cd /home/usuario/promerc-src
npm install
npx prisma generate
npx prisma migrate deploy   # aplica las migraciones ya creadas, no crea nuevas
npm run build                # genera .next/standalone/ y deja todo listo en deploy/
```

`npm run build` corre automáticamente un `postbuild` que arma la carpeta
`deploy/` con **solo** lo necesario para producción (`server.js`,
`node_modules/`, `.next/`, `public/`). No subas ni apuntes cPanel a
`.next/standalone/` directamente — esa carpeta intermedia arrastra de más
(el propio código fuente, `.git`, `.env`, la base de datos de desarrollo)
por un problema conocido del trazado de archivos de esta versión de
Next/Turbopack; `deploy/` es la que ya viene filtrada y verificada.

### Primer usuario administrador

No hay una pantalla de registro pública (correcto, es una herramienta
interna). Crea el primer admin corriendo el seed una sola vez, o insertando
el usuario manualmente vía `npx prisma studio` / SQL con una contraseña ya
hasheada con `argon2`.

## 4. Configurar "Setup Node.js App" en cPanel

- **Application root**: `promerc-src/deploy` (la carpeta generada en el paso 3).
- **Application startup file**: `server.js`.
- **Application URL**: el dominio/subdominio donde vivirá PROMERC.
- Guarda y reinicia la aplicación desde el botón de cPanel.

## 5. Después de cada actualización de código

```bash
cd /home/usuario/promerc-src
git pull   # o como actualices el código
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
```

Y reinicia la app desde cPanel (botón "Restart"). `deploy/` se regenera
completo en cada build, así que no hace falta limpiar nada a mano —
`STORAGE_ROOT` vive fuera de esa carpeta y no se toca.

## Notas

- `npx prisma migrate dev` es solo para desarrollo local (pide confirmación
  interactiva y puede resetear datos) — en producción siempre `migrate deploy`.
- Si `SMTP_*` no está configurado, el correo de recuperación de contraseña no
  se envía; sin esas variables la app no debe considerarse lista para uso
  real por el equipo.
