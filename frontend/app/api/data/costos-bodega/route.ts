import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

// Proxy del reporte de Costos de Inventario por Sucursal. El GET solo lee el
// datawarehouse propio en Postgres (rapido) - la sincronizacion contra MBA3
// vive en POST /sincronizar, que corre en background en el backend y no se
// espera aca (ver comentario en el POST de abajo).
//
// `recurso` (mismo patron que /api/data/kpi): "resumen" (default, agregado
// por sucursal), "opciones" (valores para los selectores de filtro) o
// "detalle" (linea por linea, filtrable y paginado).
const RUTA_BACKEND: Record<string, string> = {
  resumen: "",
  opciones: "/opciones",
  subbodegas: "/subbodegas",
  detalle: "/detalle",
  empresas: "/empresas",
  "sincronizar-estado": "/sincronizar/estado",
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const permisos: string[] = user?.permissions || [];
  if (!user || !(permisos.includes("VIEW_COSTOS") || user.role === "Admin")) {
    return NextResponse.json({ error: "Acceso denegado al reporte de Costos por Sucursal." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const recurso = searchParams.get("recurso") || "resumen";
  if (!(recurso in RUTA_BACKEND)) {
    return NextResponse.json({ error: `Recurso no permitido: ${recurso}` }, { status: 400 });
  }
  searchParams.delete("recurso");
  const qs = searchParams.toString();

  try {
    const res = await fetch(
      `${process.env.BACKEND_API_URL}/api/v1/costos-bodega${RUTA_BACKEND[recurso]}${qs ? `?${qs}` : ""}`,
      { headers: { "X-API-Key": process.env.INTERNAL_API_KEY || "" }, cache: "no-store" }
    );
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (error: any) {
    return NextResponse.json({ error: `Error en el proxy: ${error.message}` }, { status: 500 });
  }
}

// Dispara la sincronizacion contra MBA3. El backend la corre en background y
// responde de inmediato (status "iniciado") - por eso este POST no necesita
// (ni deberia tener) un timeout largo: la llamada real HTTP dura milisegundos,
// aunque la sincronizacion en si tarde 30-45 min en PRUEBAS.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const permisos: string[] = user?.permissions || [];
  if (!user || !(permisos.includes("MANAGE_CONFIG") || user.role === "Admin")) {
    return NextResponse.json({ error: "No autorizado para sincronizar Costos por Sucursal." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();

  try {
    const res = await fetch(`${process.env.BACKEND_API_URL}/api/v1/costos-bodega/sincronizar${qs ? `?${qs}` : ""}`, {
      method: "POST",
      headers: { "X-API-Key": process.env.INTERNAL_API_KEY || "" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (error: any) {
    return NextResponse.json({ error: `Error en el proxy: ${error.message}` }, { status: 500 });
  }
}
