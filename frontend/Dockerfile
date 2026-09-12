# Stage 1: Compilación de Next.js
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar pnpm de forma global
# Version fija: `npm install -g pnpm` agarraba la ultima de cada dia, asi que
# el build cambiaba de pnpm sin que nadie tocara nada. Debe coincidir con
# "packageManager" en package.json.
#
# NO subir a pnpm 11 sin subir antes la imagen base: pnpm 11 exige Node >=22.13
# y aca corre node:20-alpine. Con 11 el install muere en
# ERR_UNKNOWN_BUILTIN_MODULE (node:sqlite). pnpm 10.x pide Node >=18.12.
RUN npm install -g pnpm@10.34.5

# Copiar archivos de dependencias. pnpm-workspace.yaml va SI O SI en este COPY:
# ahi vive `allowBuilds`, y sin el `pnpm install` sale con codigo 1 por
# ERR_PNPM_IGNORED_BUILDS y se cae el build entero.
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./

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
# Version fija: `npm install -g pnpm` agarraba la ultima de cada dia, asi que
# el build cambiaba de pnpm sin que nadie tocara nada. Debe coincidir con
# "packageManager" en package.json.
RUN npm install -g pnpm@10.34.5

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
