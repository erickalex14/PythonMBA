import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Sembrando base de datos con roles y permisos de forma idempotente...');

  // Cifrado de las contraseñas por defecto
  const passwordHashAdmin = await bcrypt.hash('123456', 10);
  const passwordHashVisitante = await bcrypt.hash('123456', 10);

  // 1. Definir y asegurar los permisos por defecto (usando upsert)
  const permissionsData = [
    { action: 'VIEW_MOVIMIENTOS', description: 'Permite visualizar el reporte de movimientos de productos' },
    { action: 'VIEW_LIQUIDACIONES', description: 'Permite visualizar el reporte de liquidaciones de importación' },
    { action: 'VIEW_ATS', description: 'Permite visualizar el reporte fiscal ATS' },
    { action: 'VIEW_LOGS', description: 'Permite visualizar la bitácora de auditoría de descargas' },
    { action: 'DOWNLOAD_EXCEL', description: 'Permite descargar archivos Excel de los reportes' },
    { action: 'MANAGE_USERS', description: 'Permite crear, editar y eliminar usuarios en el panel de administración' },
    { action: 'MANAGE_CONFIG', description: 'Permite cambiar entre pruebas/producción y editar credenciales del ERP' },
  ];

  const permissions: any = {};
  for (const perm of permissionsData) {
    permissions[perm.action] = await prisma.permission.upsert({
      where: { action: perm.action },
      update: { description: perm.description },
      create: perm,
    });
    console.log(`Permiso asegurado: ${perm.action}`);
  }

  // 2. Crear o actualizar Rol de Administrador con TODOS los permisos
  const roleAdmin = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {
      permissions: {
        connect: Object.keys(permissions).map((action) => ({ id: permissions[action].id })),
      },
    },
    create: {
      name: 'Admin',
      permissions: {
        connect: Object.keys(permissions).map((action) => ({ id: permissions[action].id })),
      },
    },
  });
  console.log(`Rol asegurado: ${roleAdmin.name}`);

  // 3. Crear o actualizar Rol de Visitante con permisos de visualización y descarga únicamente
  const roleVisitante = await prisma.role.upsert({
    where: { name: 'Visitante' },
    update: {
      permissions: {
        set: [
          { id: permissions['VIEW_MOVIMIENTOS'].id },
          { id: permissions['VIEW_LIQUIDACIONES'].id },
          { id: permissions['VIEW_ATS'].id },
          { id: permissions['VIEW_LOGS'].id },
          { id: permissions['DOWNLOAD_EXCEL'].id },
        ],
      },
    },
    create: {
      name: 'Visitante',
      permissions: {
        connect: [
          { id: permissions['VIEW_MOVIMIENTOS'].id },
          { id: permissions['VIEW_LIQUIDACIONES'].id },
          { id: permissions['VIEW_ATS'].id },
          { id: permissions['VIEW_LOGS'].id },
          { id: permissions['DOWNLOAD_EXCEL'].id },
        ],
      },
    },
  });
  console.log(`Rol asegurado: ${roleVisitante.name}`);

  // 4. Registrar Administrador por defecto (solo si no existe)
  const adminExistente = await prisma.user.findUnique({
    where: { cedula: '1712345678' }
  });

  if (!adminExistente) {
    const admin = await prisma.user.create({
      data: {
        cedula: '1712345678',
        name: 'Administrador',
        password: passwordHashAdmin,
        roleId: roleAdmin.id,
      },
    });
    console.log(`Usuario semilla creado: ${admin.name} (Rol: Admin, Cédula: ${admin.cedula})`);
  } else {
    console.log(`Usuario administrador ya existe. Omitiendo creación.`);
  }

  // 5. Registrar Visitante por defecto (solo si no existe)
  const visitanteExistente = await prisma.user.findUnique({
    where: { cedula: '1712345680' }
  });

  if (!visitanteExistente) {
    const visitante = await prisma.user.create({
      data: {
        cedula: '1712345680',
        name: 'Visitante de Datos',
        password: passwordHashVisitante,
        roleId: roleVisitante.id,
      },
    });
    console.log(`Usuario semilla creado: ${visitante.name} (Rol: Visitante, Cédula: ${visitante.cedula})`);
  } else {
    console.log(`Usuario visitante ya existe. Omitiendo creación.`);
  }

  console.log('Sembrado RBAC completado de forma segura.');
}

main()
  .catch((e) => {
    console.error('Error durante el sembrado de la base de datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // Cerrar el pool de conexiones al terminar
  });
