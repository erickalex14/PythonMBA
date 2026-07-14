import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).permissions?.includes("VIEW_VENTAS")) {
    return NextResponse.json({ error: "Acceso denegado. No autorizado para ver el reporte de Ventas." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const inicio = searchParams.get("inicio");
  const fin = searchParams.get("fin");

  if (!inicio || !fin) {
    return NextResponse.json({ error: "Fechas de inicio y fin son obligatorias." }, { status: 400 });
  }

  const backendUrl = `${process.env.BACKEND_API_URL}/api/v1/estadisticas-ventas?inicio=${inicio}&fin=${fin}`;

  try {
    const res = await fetch(backendUrl, {
      headers: {
        "X-API-Key": process.env.INTERNAL_API_KEY || "",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: `Error en el servidor proxy de Ventas: ${error.message}` }, { status: 500 });
  }
}
