import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

// Helper para validar permisos
async function checkAuth(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).permissions.includes(permission)) {
    return null;
  }
  return session;
}

export async function GET(request: Request) {
  const session = await checkAuth("MANAGE_CONFIG");
  if (!session) {
    return new Response(JSON.stringify({ error: "Acceso denegado. No autorizado." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  const backendUrl = `${process.env.BACKEND_API_URL}/api/v1/admin/config`;

  try {
    const res = await fetch(backendUrl, {
      headers: {
        "X-API-Key": process.env.INTERNAL_API_KEY || "",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `Error del backend FastAPI: ${errText}` }), {
        status: res.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const config = await res.json();
    return NextResponse.json(config);
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Error en el servidor proxy de configuración GET: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function POST(request: Request) {
  const session = await checkAuth("MANAGE_CONFIG");
  if (!session) {
    return new Response(JSON.stringify({ error: "Acceso denegado. No autorizado." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await request.json();
    const backendUrl = `${process.env.BACKEND_API_URL}/api/v1/admin/config`;

    const res = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.INTERNAL_API_KEY || "",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `Error del backend FastAPI: ${errText}` }), {
        status: res.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const responseData = await res.json();
    return NextResponse.json(responseData);
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Error en el servidor proxy de configuración POST: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
