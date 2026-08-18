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

    // Prisma devuelve la relacion anidada (log.user.name, log.user.role.name) y con
    // los nombres reales del modelo (reportType, dateRange) - se aplana aqui a lo
    // que la tabla del front espera, para no repetir este mapeo en cada consumidor.
    const aplanados = logs.map((log) => ({
      id: log.id,
      user_name: log.user?.name ?? "(usuario eliminado)",
      user_cedula: log.user?.cedula ?? "-",
      user_role: log.user?.role?.name ?? "-",
      download_type: log.reportType,
      query_period: log.dateRange,
      records_count: log.recordsCount,
      timestamp: log.timestamp,
    }));

    return NextResponse.json(aplanados);
  } catch (error: any) {
    return NextResponse.json({ error: `Error obteniendo logs de auditoría: ${error.message}` }, { status: 500 });
  }
}
