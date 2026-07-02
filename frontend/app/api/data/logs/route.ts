import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Validar sesión
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).permissions?.includes("VIEW_LOGS")) {
    return NextResponse.json({ error: "Acceso denegado. No autorizado para ver bitácora." }, { status: 403 });
  }

  try {
    // Consultar todos los logs de descargas de la base de datos
    const logs = await prisma.downloadLog.findMany({
      include: {
        user: {
          select: {
            name: true,
            cedula: true,
            role: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        timestamp: "desc"
      }
    });

    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: `Error obteniendo logs de auditoría: ${error.message}` }, { status: 500 });
  }
}
