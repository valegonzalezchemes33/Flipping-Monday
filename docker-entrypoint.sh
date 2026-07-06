#!/bin/sh
# ============================================================================
# docker-entrypoint.sh — inicializa la DB (Postgres externo) y arranca Next.js
# ============================================================================
set -e

echo "=== monday-AI Docker Startup ==="

# Validar que DATABASE_URL apunta a Postgres (no a SQLite file:)
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL no está definido."
  echo "   Define DATABASE_URL en docker-compose.yml o .env apuntando a tu Postgres externo."
  echo "   Ejemplo: postgresql://user:pass@host:5432/monday_ai?schema=public"
  exit 1
fi

if echo "$DATABASE_URL" | grep -q '^file:'; then
  echo "❌ ERROR: DATABASE_URL apunta a SQLite (file:)."
  echo "   monday-AI en Docker requiere PostgreSQL externo."
  echo "   Actualiza DATABASE_URL a una URL de Postgres."
  exit 1
fi

echo "→ Validando conexión a PostgreSQL..."
cd /app

# Aplicar migraciones pendientes (idempotente, no rompe si ya están)
echo "→ Aplicando migraciones de Prisma..."
npx prisma migrate deploy 2>&1 | sed 's/^/  /'

# Si hay seed script, ejecutarlo (opcional — comenta si no lo necesitas)
if [ -f prisma/seed.ts ] || [ -f prisma/seed.js ]; then
  echo "→ Ejecutando seed..."
  npx prisma db seed 2>&1 | sed 's/^/  /' || echo "  (seed no disponible o falló, continuando)"
fi

echo "→ Arrancando servidor Next.js en puerto ${PORT:-3000}..."
echo "→ Accede a: http://localhost:${PORT:-3000}"
echo ""

# Arrancar el servidor standalone
exec node server.js