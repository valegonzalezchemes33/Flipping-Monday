#!/bin/sh
# ============================================================================
# docker-entrypoint.sh — inicializa la DB y arranca el servidor Next.js
# ============================================================================
set -e

echo "=== monday-AI Docker Startup ==="

# Si no existe la DB, crearla con Prisma
if [ ! -f /app/data/custom.db ]; then
  echo "→ Creando base de datos SQLite..."
  cd /app
  # Usar npx prisma porque no tenemos bun en el runtime image
  npx --yes prisma db push --skip-generate 2>/dev/null || \
    echo "  (DB ya existe o se creará automáticamente)"
else
  echo "→ DB existente detectada, saltando creación"
fi

echo "→ Arrancando servidor Next.js en puerto 3000..."
echo "→ Accede a: http://localhost:3000"
echo ""

# Arrancar el servidor standalone
exec node server.js
