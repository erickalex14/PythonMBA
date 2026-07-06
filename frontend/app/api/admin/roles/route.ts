import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// Helper para validar permisos
async function checkAuth(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).permissions.includes(permission)) {
    return null;
  }
  return session;
}

export async function GET(request: Request) {
  const session = await checkAuth("MANAGE_USERS");
  if (!session) {
    return new Response(JSON.stringify({ error: "Acceso denegado. No autorizado." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          select: {
            id: true,
            action: true,
          }
        }
      },
      orderBy: { name: "asc" }
    });

    const permissions = await prisma.permission.findMany({
      select: {
        id: true,
        action: true,
        description: true
      },
      orderBy: { action: "asc" }
    });

    return NextResponse.json({ roles, permissions });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Error obteniendo roles: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function POST(request: Request) {
  const session = await checkAuth("MANAGE_USERS");
  if (!session) {
    return new Response(JSON.stringify({ error: "Acceso denegado. No autorizado." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { name, permissionIds } = await request.json();

    if (!name || !Array.isArray(permissionIds)) {
      return new Response(JSON.stringify({ error: "Parámetros incompletos." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const nameTrim = name.trim();
    // Comprobar si el rol ya existe
    const existing = await prisma.role.findUnique({ where: { name: nameTrim } });
    if (existing) {
      return new Response(JSON.stringify({ error: "Ya existe un rol con este nombre." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const newRole = await prisma.role.create({
      data: {
        name: nameTrim,
        permissions: {
          connect: permissionIds.map((id: string) => ({ id }))
        }
      },
      include: {
        permissions: true
      }
    });

    return NextResponse.json(newRole);
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Error creando rol: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function PUT(request: Request) {
  const session = await checkAuth("MANAGE_USERS");
  if (!session) {
    return new Response(JSON.stringify({ error: "Acceso denegado. No autorizado." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { id, name, permissionIds } = await request.json();

    if (!id || !name || !Array.isArray(permissionIds)) {
      return new Response(JSON.stringify({ error: "Parámetros incompletos." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const nameTrim = name.trim();
    // Comprobar si el nombre del rol ya está en uso por otro
    const existing = await prisma.role.findFirst({
      where: {
        name: nameTrim,
        id: { not: id }
      }
    });
    if (existing) {
      return new Response(JSON.stringify({ error: "Ya existe otro rol con este nombre." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Obtener los permisos anteriores para hacer desconexión
    const previousRole = await prisma.role.findUnique({
      where: { id },
      include: { permissions: true }
    });

    if (!previousRole) {
      return new Response(JSON.stringify({ error: "Rol no encontrado." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        name: nameTrim,
        permissions: {
          disconnect: previousRole.permissions.map((p: any) => ({ id: p.id })),
          connect: permissionIds.map((pid: string) => ({ id: pid }))
        }
      },
      include: {
        permissions: true
      }
    });

    return NextResponse.json(updatedRole);
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Error editando rol: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function DELETE(request: Request) {
  const session = await checkAuth("MANAGE_USERS");
  if (!session) {
    return new Response(JSON.stringify({ error: "Acceso denegado. No autorizado." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new Response(JSON.stringify({ error: "ID del rol faltante." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // No permitir borrar roles por defecto del sistema
    const roleToDelete = await prisma.role.findUnique({ where: { id } });
    if (roleToDelete?.name === "Admin" || roleToDelete?.name === "Visitante") {
      return new Response(JSON.stringify({ error: "No es posible eliminar los roles por defecto del sistema (Admin/Visitante)." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Comprobar si hay usuarios asignados a este rol
    const usersCount = await prisma.user.count({ where: { roleId: id } });
    if (usersCount > 0) {
      return new Response(JSON.stringify({ error: `No es posible eliminar el rol porque tiene ${usersCount} usuario(s) asignado(s).` }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await prisma.role.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Rol eliminado correctamente." });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Error eliminando rol: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
