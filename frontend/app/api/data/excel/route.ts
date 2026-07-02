import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  // 1. Validar autenticación de sesión y permisos
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).permissions?.includes("DOWNLOAD_EXCEL")) {
    return new Response(JSON.stringify({ error: "Acceso denegado. No autorizado para descargar reportes." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "movimientos", "liquidaciones", "ats"
  const inicio = searchParams.get("inicio");
  const fin = searchParams.get("fin");

  if (!type || !inicio || !fin) {
    return new Response(JSON.stringify({ error: "Parámetros faltantes (type, inicio, fin)." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Mapear rutas de FastAPI
  let endpoint = "";
  if (type === "movimientos") endpoint = "movimientos";
  else if (type === "liquidaciones") endpoint = "liquidaciones";
  else if (type === "ats") endpoint = "ats";
  else {
    return new Response(JSON.stringify({ error: "Tipo de reporte no válido." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const backendUrl = `${process.env.BACKEND_API_URL}/api/v1/excel/${endpoint}?inicio=${inicio}&fin=${fin}`;

  try {
    // 2. Consultar el Excel al microservicio FastAPI
    const res = await fetch(backendUrl, {
      headers: {
        "X-API-Key": process.env.INTERNAL_API_KEY || "",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `Error del backend: ${errText}` }), {
        status: res.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Registrar la descarga en la base de datos de auditoría
    await prisma.downloadLog.create({
      data: {
        userId: session.user.id,
        reportType: type,
        dateRange: `${inicio} a ${fin}`,
      },
    });

    // 4. Retornar el archivo binario
    const excelBuffer = await res.arrayBuffer();
    const headers = new Headers();
    headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    headers.set("Content-Disposition", res.headers.get("Content-Disposition") || `attachment; filename=Reporte_${type}.xlsx`);

    return new Response(excelBuffer, {
      status: 200,
      headers
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Error en el servidor proxy de Excel: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function POST(request: Request) {
  // 1. Validar autenticación de sesión y permisos
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).permissions?.includes("DOWNLOAD_EXCEL")) {
    return new Response(JSON.stringify({ error: "Acceso denegado. No autorizado para descargar reportes." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { type, inicio, fin, data } = await request.json();

    if (!type || !inicio || !fin || !data || !Array.isArray(data)) {
      return new Response(JSON.stringify({ error: "Parámetros faltantes (type, inicio, fin, data)." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let sheetName = "Reporte";
    let filenamePrefix = "Reporte";
    if (type === "movimientos") {
      sheetName = "Movimientos";
      filenamePrefix = "Reporte_Movimientos_MBA3";
    } else if (type === "liquidaciones") {
      sheetName = "Consolidado";
      filenamePrefix = "Reporte_Liquidaciones_Consolidado";
    } else if (type === "ats") {
      sheetName = "Consolidado";
      filenamePrefix = "Reporte_Facturacion_Fiscal";
    }

    const backendUrl = `${process.env.BACKEND_API_URL}/api/v1/excel/export`;

    // 2. Enviar el JSON filtrado al backend
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.INTERNAL_API_KEY || "",
      },
      body: JSON.stringify({
        sheet_name: sheetName,
        filename_prefix: filenamePrefix,
        data: data
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `Error del backend: ${errText}` }), {
        status: res.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Registrar la descarga en la base de datos de auditoría
    await prisma.downloadLog.create({
      data: {
        userId: session.user.id,
        reportType: `${type} (Filtrado)`,
        dateRange: `${inicio} a ${fin}`,
      },
    });

    // 4. Retornar el archivo binario
    const excelBuffer = await res.arrayBuffer();
    const headers = new Headers();
    headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    headers.set("Content-Disposition", res.headers.get("Content-Disposition") || `attachment; filename=${filenamePrefix}.xlsx`);

    return new Response(excelBuffer, {
      status: 200,
      headers
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Error en el servidor proxy de Excel POST: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

