import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

// Dashboard de ventas: una sola llamada con los totales por rango, sus
// comparativos y los tops. Reemplaza las cuatro llamadas de lineas crudas que
// hacia el dashboard anterior (~45 MB) por unos pocos KB agregados en SQL.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).permissions?.includes("VIEW_VENTAS")) {
    return NextResponse.json({ error: "Acceso denegado. No autorizado para ver el dashboard de Ventas." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fechaAncla = searchParams.get("fecha_ancla");

  let backendUrl = `${process.env.BACKEND_API_URL}/api/v1/ventas/dashboard`;
  if (fechaAncla) {
    backendUrl += `?fecha_ancla=${fechaAncla}`;
  }

  try {
    const res = await fetch(backendUrl, {
      headers: { "X-API-Key": process.env.INTERNAL_API_KEY || "" },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (error: any) {
    return NextResponse.json({ error: `Error en el servidor proxy del Dashboard: ${error.message}` }, { status: 500 });
  }
}
