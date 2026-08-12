# Despliegue en cPanel (Setup Node.js App)

Hosting compartido (CloudLinux 8, cPanel), sin acceso root. El build de la
app **nunca corre en el servidor** — se compila local en Docker y se sube ya
armado. Se decidió así a propósito: `npm run build` de este proyecto puede
necesitar más RAM/CPU de la que da un plan compartido, y un build fallido a
medias ahí podría afectar a otras cuentas del mismo servidor. Existe un
`.cpanel.yml` con build automático vía Git Version Control como alternativa,
pero se descartó por el mismo motivo — no lo agregues de vuelta sin repensar
ese riesgo primero.

## Antes de empezar (una sola vez)

- Docker instalado en tu máquina local.
- Subdominio creado en cPanel (**Dominios**) y su SSL activo (**SSL/TLS
  Status** → Run AutoSSL) — sin HTTPS el login no funciona, la cookie de
  sesión usa `secure: true` en producción.
- Base de datos PostgreSQL creada desde cPanel (usuario, password, nombre).
- Acceso a Terminal en cPanel (para migraciones — ver más abajo, no para build).

## 1. Build local (Docker)

```bash
./build-for-cpanel.sh
```

Esto compila dentro de un contenedor **AlmaLinux 8** (el rebuild público más
cercano a CloudLinux 8 — mismo glibc, mismos paquetes) y genera `deploy/`
con `server.js`, `node_modules/`, `.next/`, `public/`, `package.json` y
`package-lock.json`.

**Por qué Docker y no compilar directo en tu máquina**: `argon2` usa un
binario nativo. El prebuild que trae el paquete de npm por defecto exige
`GLIBC_2.34`, más nuevo que el `2.28` de CloudLinux 8 — no carga ahí sin
importar en qué máquina corriste `npm install` (el binario ya viene
compilado dentro del paquete, no se genera según tu SO). El script fuerza
una compilación real desde código fuente dentro del contenedor
(`node-gyp rebuild`, con Python 3.9 porque el `node-gyp` actual necesita
Python ≥3.8 y AlmaLinux 8 trae 3.6 por defecto) y coloca el resultado en
`node_modules/argon2/prebuilds/linux-x64/argon2.glibc.node` — la misma ruta
que el tracer de Next.js espera para empaquetarlo (si esa carpeta no existe
con ese nombre exacto, Next no encuentra qué copiar y el binario
simplemente falta en `deploy/`, sin avisar en el build).

Si en el futuro se agrega otra dependencia con binario nativo y falla igual
al arrancar la app (revisa el log, buscarás un error `GLIBC_X.XX not
found`), aplica el mismo patrón en `build-for-cpanel.sh`.

`package.json`/`package-lock.json` se copian a `deploy/` aunque no se
usen para correr la app — "Setup Node.js App" de cPanel (basado en
`nodevenv`) los necesita para crear su entorno virtual; sin ellos da
`Unable to find app venv folder by this path`.

## 2. Subir `deploy/`

```bash
zip -r deploy.zip deploy/
```

Por cPanel → **Administrador de Archivos**, sube `deploy.zip` a
`promerc-src/` y extrae. **Antes de extraer una actualización, borra la
carpeta `deploy/` vieja completa** — extraer encima sin borrar puede dejar
mezclados archivos de dos builds distintos (nos pasó: un binario de
`argon2` viejo sobrevivió a un re-deploy porque no se borró la carpeta
antes).

## 3. Migraciones (paquete aparte, `prisma` no viaja en `deploy/`)

`prisma` es `devDependency` — Next.js no lo incluye en el standalone.
Empaqueta aparte, solo lo necesario para migrar (sin `argon2`, sin
`src/`, sin el resto de la app):

```bash
mkdir -p promerc-migrate
cp -r prisma promerc-migrate/
cp prisma.config.ts package.json package-lock.json promerc-migrate/
zip -r promerc-migrate.zip promerc-migrate/
rm -rf promerc-migrate
```

Sube y extrae `promerc-migrate.zip` igual que `deploy.zip`. Luego, en el
**Terminal de cPanel**:

```bash
# La Terminal de cPanel usa el Node del sistema por default (viejo, ~v10),
# NO el que configuraste en "Setup Node.js App" — hay que activarlo:
source /home/USUARIO/nodevenv/promerc-src/deploy/22/bin/activate
node -v   # confirma que diga v22.x, no v10.x

cd ~/promerc-src/promerc-migrate
npm install prisma@7.9.0 --no-save   # instala solo el CLI, es pure-JS (Prisma 7 es "Rust-free"), no hay riesgo de binario nativo aquí
DATABASE_URL="postgresql://USUARIO_DB:PASSWORD@127.0.0.200:5432/NOMBRE_DB" npx prisma migrate deploy
```

`127.0.0.200` es la IP interna que usa Postgres en este servidor (la misma
que ve phpPgAdmin) — el acceso remoto externo (desde tu máquina) al 5432
está bloqueado por firewall en este hosting, así que las migraciones
**siempre se corren desde el propio Terminal del servidor**, nunca desde
tu máquina.

## 4. Usuario admin y datos base (primera vez)

No hay pantalla de registro pública. `prisma/seed.ts` no se puede correr
tal cual en el servidor (necesita `src/generated/prisma` y `argon2`, que no
están en el bundle de migración) — en su lugar:

1. Genera el hash localmente (portable, no importa el SO — el hash de
   argon2 es un string, no un binario):
   ```bash
   node -e 'require("argon2").hash("TU_PASSWORD").then(console.log)'
   ```
2. Conéctate por `psql` **usando el mismo usuario de `DATABASE_URL` que
   corrió las migraciones** — ese es el dueño de las tablas y el único con
   permiso de `INSERT`. **No uses el login por default de phpPgAdmin**: en
   este hosting entra con un rol distinto (`contacto`) sin permisos sobre
   las tablas de la app, y además la caja de "SQL" de phpPgAdmin envuelve
   cualquier consulta en `SELECT COUNT(*) FROM (...)`, lo que rompe
   cualquier `INSERT`/`UPDATE` — solo sirve para `SELECT`.
   ```bash
   psql "postgresql://USUARIO_DB:PASSWORD@127.0.0.200:5432/NOMBRE_DB"
   ```
3. Inserta lo que hace `seed.ts`: una `Ubicacion`, el `Usuario` ADMIN (con
   el hash del paso 1), un `Articulo`, la `ToleranciaConfig` global y las
   `UnidadEmpaque`. Ver ejemplo de estos `INSERT` en el historial de este
   despliegue si hace falta repetirlo.

## 5. Configurar "Setup Node.js App"

- **Node.js version**: 20.9.0 o superior (requisito de `package.json`).
- **Application root**: `promerc-src/deploy`.
- **Application URL**: el subdominio ya creado con SSL.
- **Application startup file**: `server.js`.
- **Environment Variables** — captura una por una (Name/Value), valores de
  referencia en `.env.production.example`:
  - `APP_URL`, `DATABASE_URL` (con la IP interna `127.0.0.200`, no una
    pública — la app corre en el propio servidor), `SESSION_SECRET`
    (`openssl rand -base64 32`), `STORAGE_ROOT` (ruta fuera de `deploy/`,
    ej. `/home/usuario/promerc-storage`), `NODE_ENV=production`, y
    `SMTP_*` si ya hay correo configurado.
- **No le des clic a "Run NPM Install"** — `node_modules` ya viene armado y
  compatible dentro de `deploy/`; reinstalar ahí lo pisa con paquetes que
  quizás no coincidan con el entorno de build de Docker.
- Guarda y **Restart**.

## Después de cada actualización de código

**Si solo cambió código de la app (sin tocar `prisma/schema.prisma`):**
1. `./build-for-cpanel.sh`
2. `zip -r deploy.zip deploy/`
3. Borrar `deploy/` vieja en el servidor, subir y extraer el zip nuevo.
4. Restart en "Setup Node.js App".

**Si además hay una migración nueva** (`prisma migrate dev` corrido local
primero, como siempre en desarrollo):
1. Repite el paquete de migración del paso 3 de arriba (`promerc-migrate.zip`
   con la carpeta `prisma/` actualizada) y corre `prisma migrate deploy` en
   el Terminal.
2. Sigue con los 4 pasos de "solo cambió código" para desplegar la app.

## Notas

- `npx prisma migrate dev` es solo para desarrollo local (pide confirmación
  interactiva y puede resetear datos) — en producción siempre `migrate deploy`.
- Si `SMTP_*` no está configurado, el correo de recuperación de contraseña no
  se envía; sin esas variables la app no debe considerarse lista para uso
  real por el equipo.
- Revisa logs de errores de la app en cPanel → "Setup Node.js App" → detalle
  de la app (stderr) — ahí aparecen los crashes al arrancar, como el de
  `GLIBC` que motivó el fix de `argon2` en el paso 1.
