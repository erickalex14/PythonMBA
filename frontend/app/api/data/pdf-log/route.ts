import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Acceso denegado. No autorizado." }, { status: 401 });
  }

  try {
    const { type, inicio, fin } = await request.json();

    await prisma.downloadLog.create({
      data: {
        userId: session.user.id,
        reportType: `${type} (PDF)`,
        dateRange: `${inicio} a ${fin}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: `Error registrando auditoría de PDF: ${error.message}` }, { status: 500 });
  }
}
