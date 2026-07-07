import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";
import type { NextFetchEvent } from "next/server";

const authMiddleware = withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: {
    signIn: "/auth/acceso",
  },
});

// Toda página HTML de esta app depende de sesión/permisos por usuario y el
// entorno tiene cachés intermedios (proxy corporativo/CDN) que guardan HTML
// por URL. Por eso: no-store en TODOS los documentos. Los assets estáticos
// (_next/static) quedan fuera del matcher y conservan su caché inmutable.
export default async function middleware(req: NextRequestWithAuth, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  let res: Response;
  if (pathname.startsWith("/panel")) {
    res = (await authMiddleware(req, event)) ?? NextResponse.next();
  } else {
    res = NextResponse.next();
  }

  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export const config = {
  // Todo excepto assets estáticos versionados e imágenes/fuentes públicas
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|svg|ico|jpg|jpeg|webp|woff2?)).*)",
  ],
};
