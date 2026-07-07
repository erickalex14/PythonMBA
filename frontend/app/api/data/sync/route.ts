import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

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

  const validTypes = ["movimientos", "liquidaciones", "ats", "ventas"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: `Tipo de sincronización inválido: ${type}` }, { status: 400 });
  }

  let backendUrl = `${process.env.BACKEND_API_URL}/api/v1/sync/${type}?inicio=${inicio}&fin=${fin}`;
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
