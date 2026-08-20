import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

// Proxy unico para el reporte de Seguimiento KPI. Se usa `?recurso=` en vez de
// una ruta catch-all para no depender de como esta version de Next entrega los
// params dinamicos (ver frontend/AGENTS.md).
const LECTURA = ["seguimiento", "definicion", "sucursales", "metas", "excel"];
const ESCRITURA = ["metas", "valores-manuales", "importar"];

async function sesionCon(permiso: string) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user) return null;
  const permisos: string[] = user.permissions || [];
  return permisos.includes(permiso) || user.role === "Admin" ? user : null;
}

/** Reenvia al backend conservando la query, sin exponer la API key al navegador. */
function urlBackend(recurso: string, request: Request) {
  const { searchParams } = new URL(request.url);
  searchParams.delete("recurso");
  const qs = searchParams.toString();
  return `${process.env.BACKEND_API_URL}/api/v1/kpi/${recurso}${qs ? `?${qs}` : ""}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recurso = searchParams.get("recurso") || "seguimiento";
  if (!LECTURA.includes(recurso)) {
    return NextResponse.json({ error: `Recurso no permitido: ${recurso}` }, { status: 400 });
  }
  if (!(await sesionCon("VIEW_VENTAS"))) {
    return NextResponse.json({ error: "Acceso denegado al Seguimiento KPI." }, { status: 403 });
  }

  try {
    const res = await fetch(urlBackend(recurso, request), {
      headers: { "X-API-Key": process.env.INTERNAL_API_KEY || "" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }
    // El Excel vuelve como binario: se reenvia tal cual con su nombre de archivo.
    if (recurso === "excel") {
      return new NextResponse(await res.arrayBuffer(), {
        status: 200,
        headers: {
          "Content-Type": res.headers.get("content-type") || "application/octet-stream",
          "Content-Disposition": res.headers.get("content-disposition") || "attachment",
        },
      });
    }
    return NextResponse.json(await res.json());
  } catch (error: any) {
    return NextResponse.json({ error: `Error en el proxy: ${error.message}` }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const recurso = searchParams.get("recurso") || "";
  if (!ESCRITURA.includes(recurso)) {
    return NextResponse.json({ error: `Recurso no permitido: ${recurso}` }, { status: 400 });
  }
  if (!(await sesionCon("MANAGE_CONFIG"))) {
    return NextResponse.json({ error: "No autorizado para editar metas." }, { status: 403 });
  }

  try {
    const res = await fetch(urlBackend(recurso, request), {
      method: "PUT",
      headers: {
        "X-API-Key": process.env.INTERNAL_API_KEY || "",
        "Content-Type": "application/json",
      },
      body: await request.text(),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: `Error en el proxy: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("recurso") !== "importar") {
    return NextResponse.json({ error: "Recurso no permitido." }, { status: 400 });
  }
  if (!(await sesionCon("MANAGE_CONFIG"))) {
    return NextResponse.json({ error: "No autorizado para importar metas." }, { status: 403 });
  }

  try {
    // Se reenvia el multipart sin reconstruirlo: fetch arma el boundary solo.
    const entrada = await request.formData();
    const salida = new FormData();
    const archivo = entrada.get("archivo");
    if (!archivo) {
      return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
    }
    salida.append("archivo", archivo);

    const res = await fetch(urlBackend("importar", request), {
      method: "POST",
      headers: { "X-API-Key": process.env.INTERNAL_API_KEY || "" },
      body: salida,
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: `Error en el proxy: ${error.message}` }, { status: 500 });
  }
}
