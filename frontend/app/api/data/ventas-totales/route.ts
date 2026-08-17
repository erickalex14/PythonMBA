import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

// Totales del rango con devoluciones desglosadas para los KPIs del reporte de
// Ventas. Va aparte del listado porque las devoluciones no estan en la vista de
// ventas (filtra origin_memo='CLIENTES'), asi que el front no puede sumarlas.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).permissions?.includes("VIEW_VENTAS")) {
    return NextResponse.json({ error: "Acceso denegado. No autorizado para ver Ventas." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const inicio = searchParams.get("inicio");
  const fin = searchParams.get("fin");

  if (!inicio || !fin) {
    return NextResponse.json({ error: "Parámetros 'inicio' y 'fin' son obligatorios." }, { status: 400 });
  }

  try {
    const res = await fetch(`${process.env.BACKEND_API_URL}/api/v1/ventas/totales?inicio=${inicio}&fin=${fin}`, {
      headers: { "X-API-Key": process.env.INTERNAL_API_KEY || "" },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (error: any) {
    return NextResponse.json({ error: `Error en el servidor proxy de Totales: ${error.message}` }, { status: 500 });
  }
}
