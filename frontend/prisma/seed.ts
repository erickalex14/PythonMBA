import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Sembrando base de datos con roles y permisos (RBAC)...');

  // Cifrado de las contraseñas
  const passwordHashAdmin = await bcrypt.hash('123456', 10);
  const passwordHashVisitante = await bcrypt.hash('123456', 10);

  // 1. Limpiar registros existentes en orden de dependencia
  await prisma.downloadLog.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.permission.deleteMany({});

  // 2. Definir los permisos por defecto
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
    permissions[perm.action] = await prisma.permission.create({
      data: perm,
    });
    console.log(`Permiso creado: ${perm.action}`);
  }

  // 3. Crear Rol de Administrador con TODOS los permisos
  const roleAdmin = await prisma.role.create({
    data: {
      name: 'Admin',
      permissions: {
        connect: Object.keys(permissions).map((action) => ({ id: permissions[action].id })),
      },
    },
  });
  console.log(`Rol creado: ${roleAdmin.name}`);

  // 4. Crear Rol de Visitante con permisos de visualización y descarga únicamente
  const roleVisitante = await prisma.role.create({
    data: {
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
  console.log(`Rol creado: ${roleVisitante.name}`);

  // 5. Registrar Administrador
  const admin = await prisma.user.create({
    data: {
      cedula: '1712345678',
      name: 'Administrador',
      password: passwordHashAdmin,
      roleId: roleAdmin.id,
    },
  });
  console.log(`Usuario creado: ${admin.name} (Rol: Admin, Cédula: ${admin.cedula})`);

  // 6. Registrar Visitante
  const visitante = await prisma.user.create({
    data: {
      cedula: '1712345680',
      name: 'Visitante de Datos',
      password: passwordHashVisitante,
      roleId: roleVisitante.id,
    },
  });
  console.log(`Usuario creado: ${visitante.name} (Rol: Visitante, Cédula: ${visitante.cedula})`);

  console.log('Sembrado RBAC completado con éxito.');
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
