import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/reportesmba",
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
  experimental: {
    // Default es 10MB: la exportacion de Excel manda el dataset filtrado completo
    // como JSON en el POST a /api/data/excel, y un rango de varios meses lo supera.
    // ponytail: 100mb cubre rangos normales (dia/semana/mes); si en el futuro se
    // exportan rangos de varios meses de golpe, cambiar el export a mandar
    // inicio/fin y que el backend regenere en vez de mandar las filas ya traidas.
    proxyClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
