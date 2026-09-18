import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// Helper para validar permisos (mismo patrón que app/api/admin/*/route.ts)
async function checkAuth(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).permissions.includes(permission)) {
    return null;
  }
  return session;
}

// GET no está gateado por permiso: cualquier sesión autenticada necesita leer
// el acomodo guardado para poder PINTAR su dashboard (es una config global,
// no una que el usuario edite) -- solo POST (guardar) requiere MANAGE_DASHBOARDS.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return new Response(JSON.stringify({ error: "Acceso denegado. No autorizado." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dashboardId = searchParams.get("dashboardId");

    if (!dashboardId) {
      return new Response(JSON.stringify({ error: "Falta el parámetro dashboardId." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const filas = await prisma.dashboardLayout.findMany({ where: { dashboardId } });

    return NextResponse.json(
      filas.map((f) => ({ cardId: f.cardId, x: f.x, y: f.y, w: f.w, h: f.h }))
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Error obteniendo el acomodo del dashboard: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function POST(request: Request) {
  const session = await checkAuth("MANAGE_DASHBOARDS");
  if (!session) {
    return new Response(JSON.stringify({ error: "Acceso denegado. No autorizado." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { dashboardId, layout } = await request.json();

    if (!dashboardId || !Array.isArray(layout)) {
      return new Response(JSON.stringify({ error: "Parámetros incompletos." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await prisma.$transaction(
      layout.map((item: { cardId: string; x: number; y: number; w: number; h: number }) =>
        prisma.dashboardLayout.upsert({
          where: { dashboardId_cardId: { dashboardId, cardId: item.cardId } },
          update: { x: item.x, y: item.y, w: item.w, h: item.h },
          create: { dashboardId, cardId: item.cardId, x: item.x, y: item.y, w: item.w, h: item.h },
        })
      )
    );

    return NextResponse.json({ success: true, message: "Acomodo guardado correctamente." });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Error guardando el acomodo del dashboard: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
