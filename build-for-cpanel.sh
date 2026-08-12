#!/usr/bin/env bash
# Compila deploy/ dentro de un contenedor equivalente al servidor cPanel
# (CloudLinux 8 / AlmaLinux 8, Node 20), para que los binarios nativos
# (argon2, etc.) sean compatibles con el hosting sin compilar ahí.
#
# Uso: ./build-for-cpanel.sh
set -euo pipefail
cd "$(dirname "$0")"

docker build -t promerc-build -f Dockerfile.build .

docker run --rm \
  -v "$PWD":/app \
  -w /app \
  -e DATABASE_URL="postgresql://build:build@localhost:5432/build" \
  promerc-build \
  bash -c "
    set -e
    rm -rf node_modules .next deploy
    npm install
    # El prebuild de argon2 que trae npm exige GLIBC_2.34 (más nuevo que el
    # 2.28 de CloudLinux 8/AlmaLinux 8) — se compila desde código fuente en
    # este contenedor y se deja en prebuilds/linux-x64/argon2.glibc.node,
    # la misma ruta que el tracer de Next.js espera para empaquetarlo
    # (si se borra esa carpeta, Next no encuentra nada que copiar).
    (cd node_modules/argon2 && npx node-gyp rebuild --python=/usr/bin/python3.9)
    cp node_modules/argon2/build/Release/argon2.node node_modules/argon2/prebuilds/linux-x64/argon2.glibc.node
    rm -rf node_modules/argon2/build
    npx prisma generate
    npm run build
  "

echo ""
echo "Listo: deploy/ generado con binarios compatibles con CloudLinux 8."
echo "Súbela al servidor (File Manager o git) y corre las migraciones desde ahí."
