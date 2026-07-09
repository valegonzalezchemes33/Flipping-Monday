# ============================================================================
# Dockerfile — monday-AI multi-stage build
# ============================================================================
# Stage 1: Install deps + build
# Stage 2: Runtime minimal (solo lo necesario para correr)
# ============================================================================
FROM node:22-slim AS builder

# Instalar bun para usar el bun.lock y reproducir exactamente las deps
RUN npm install -g bun

WORKDIR /app

# Copiar solo package.json + lockfile para cache de layers
COPY package.json bun.lock* ./
COPY prisma ./prisma

# Instalar dependencias
RUN bun install --frozen-lockfile

# Generar Prisma client
RUN bunx prisma generate

# Copiar el resto del código
COPY . .

# Build de producción
RUN bun run build

# ============================================================================
# Stage 2: Runtime
# ============================================================================
FROM node:22-slim AS runner

WORKDIR /app

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/app/data/custom.db
# Z.ai SDK key — se puede override desde docker-compose
ENV ZAI_API_KEY=""

# Instalar solo lo mínimo necesario
# openssl para Prisma, sqlite3 para debug
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copiar standalone build + static + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copiar Prisma schema + migrations para crear la DB al arrancar
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Crear directorio de datos persistente (volume mount point)
RUN mkdir -p /app/data

# Exponer puerto
EXPOSE 3000

# Script de entrypoint: crea la DB si no existe y arranca el server
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

CMD ["/app/docker-entrypoint.sh"]
