import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

// Cobertura del staging: hasta que dia esta sincronizado cada tipo y que dias
// del rango quedaron sin datos.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).permissions?.includes("MANAGE_CONFIG")) {
    return NextResponse.json({ error: "Acceso denegado. No autorizado para ver el estado de sincronización." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const inicio = searchParams.get("inicio");
  const fin = searchParams.get("fin");

  if (!inicio || !fin) {
    return NextResponse.json({ error: "Parámetros 'inicio' y 'fin' son obligatorios." }, { status: 400 });
  }

  const backendUrl = `${process.env.BACKEND_API_URL}/api/v1/sync/cobertura?inicio=${inicio}&fin=${fin}`;

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
    return NextResponse.json({ error: `Error en el servidor proxy de Cobertura: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).permissions?.includes("MANAGE_CONFIG")) {
    return NextResponse.json({ error: "Acceso denegado. No autorizado para sincronizar datos." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "movimientos" | "liquidaciones" | "ats" | "ventas"
  const inicio = searchParams.get("inicio");
  const fin = searchParams.get("fin");
  const env = searchParams.get("env"); // "PRUEBAS" | "PROD"

  if (!type || !inicio || !fin) {
    return NextResponse.json({ error: "Parámetros 'type', 'inicio' y 'fin' son obligatorios." }, { status: 400 });
  }

  const validTypes = ["movimientos", "liquidaciones", "ats", "ventas", "kpi"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: `Tipo de sincronización inválido: ${type}` }, { status: 400 });
  }

  // El KPI sincroniza a su propio schema con un endpoint aparte: no comparte
  // tablas con Ventas ni Rentabilidad.
  let backendUrl =
    type === "kpi"
      ? `${process.env.BACKEND_API_URL}/api/v1/kpi/sincronizar-ventas?inicio=${inicio}&fin=${fin}`
      : `${process.env.BACKEND_API_URL}/api/v1/sync/${type}?inicio=${inicio}&fin=${fin}`;
  if (env) {
    backendUrl += `&env=${env.toUpperCase()}`;
  }

  try {
    const res = await fetch(backendUrl, {
      method: "POST",
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
    return NextResponse.json({ error: `Error en el servidor proxy de Sincronización: ${error.message}` }, { status: 500 });
  }
}
