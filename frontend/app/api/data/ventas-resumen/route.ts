import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).permissions?.includes("VIEW_VENTAS")) {
    return NextResponse.json({ error: "Acceso denegado. No autorizado para ver reporte de Ventas." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fechaAncla = searchParams.get("fecha_ancla");

  if (!fechaAncla) {
    return NextResponse.json({ error: "fecha_ancla es obligatoria." }, { status: 400 });
  }

  const backendUrl = `${process.env.BACKEND_API_URL}/api/v1/ventas/resumen?fecha_ancla=${fechaAncla}`;

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
    return NextResponse.json({ error: `Error en el servidor proxy de Resumen Ventas: ${error.message}` }, { status: 500 });
  }
}
