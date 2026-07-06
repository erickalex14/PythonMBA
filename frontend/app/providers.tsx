"use client";

// ============================================================
// FETCH INTERCEPTOR - MODULE SCOPE
// Se ejecuta al importar el módulo, ANTES de que React monte.
// Esto es CRÍTICO: SessionProvider de next-auth hace fetch a
// /api/auth/session en su primer useEffect. Si no interceptamos
// ANTES de eso, las peticiones van a la URL incorrecta.
// ============================================================
if (typeof window !== "undefined") {
  const _origFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === "string") {
      if (input.startsWith("/api/auth")) {
        input = "/reportesmba" + input;
      }
    } else if (input instanceof Request) {
      try {
        const url = new URL(input.url);
        if (url.pathname.startsWith("/api/auth")) {
          const fixed = url.origin + "/reportesmba" + url.pathname + url.search;
          input = new Request(fixed, input);
        }
      } catch {
        // ignore URL parse errors
      }
    }
    return _origFetch.call(window, input, init);
  } as typeof window.fetch;
}

import React from "react";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/reportesmba/api/auth">
      {children}
    </SessionProvider>
  );
}
