import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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
    const users = await prisma.user.findMany({
      select: {
        id: true,
        cedula: true,
        name: true,
        roleId: true,
        createdAt: true,
        role: {
          select: {
            name: true,
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const roles = await prisma.role.findMany({
      select: {
        id: true,
        name: true
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json({ users, roles });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Error obteniendo usuarios: ${error.message}` }), {
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
    const { name, cedula, password, roleId } = await request.json();

    if (!name || !cedula || !password || !roleId) {
      return new Response(JSON.stringify({ error: "Parámetros incompletos." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Comprobar si la cédula ya existe
    const existing = await prisma.user.findUnique({ where: { cedula } });
    if (existing) {
      return new Response(JSON.stringify({ error: "El número de cédula ya está registrado." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        cedula,
        password: passwordHash,
        roleId
      },
      select: {
        id: true,
        name: true,
        cedula: true,
        roleId: true,
        createdAt: true
      }
    });

    return NextResponse.json(newUser);
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Error creando usuario: ${error.message}` }), {
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
    const { id, name, cedula, password, roleId } = await request.json();

    if (!id || !name || !cedula || !roleId) {
      return new Response(JSON.stringify({ error: "Parámetros incompletos." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Validar cédula única con otros usuarios
    const existing = await prisma.user.findFirst({
      where: {
        cedula,
        id: { not: id }
      }
    });
    if (existing) {
      return new Response(JSON.stringify({ error: "El número de cédula ya está asignado a otro usuario." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const updateData: any = {
      name,
      cedula,
      roleId
    };

    if (password && password.trim() !== "") {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        cedula: true,
        roleId: true,
        createdAt: true
      }
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Error editando usuario: ${error.message}` }), {
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
      return new Response(JSON.stringify({ error: "ID del usuario faltante." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Evitar que el administrador se elimine a sí mismo
    if (id === (session.user as any).id) {
      return new Response(JSON.stringify({ error: "No es posible eliminarse a sí mismo de la base de datos." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Usuario eliminado correctamente." });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Error eliminando usuario: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
