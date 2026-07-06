# Stage 1: Compilación de Next.js
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar pnpm de forma global
RUN npm install -g pnpm

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml* ./

# Instalar todas las dependencias
RUN pnpm install --frozen-lockfile

# Copiar el código fuente
COPY . .

# Definir variables de entorno simuladas requeridas en tiempo de compilación por Next.js / Prisma
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NEXTAUTH_SECRET="dummy-secret-key-during-build"
ARG NEXTAUTH_URL="http://localhost:3000"
ENV NEXTAUTH_URL=$NEXTAUTH_URL

# Generar el cliente de Prisma para que TypeScript resuelva 'PrismaClient'
RUN pnpm prisma generate

# Compilar el proyecto Next.js en producción
RUN pnpm run build

# Stage 2: Imagen de ejecución (ligera)
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm

# Copiar únicamente los archivos necesarios compilados del Stage 1
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/prisma.config.ts ./

# Exponer el puerto de ejecución del frontend
EXPOSE 3000

# Ejecutar sincronización de esquema de Prisma, insertar la semilla (seed) de usuarios/roles, y arrancar el servidor Next.js
CMD pnpm prisma db push --accept-data-loss && pnpm prisma db seed && pnpm run start
