import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/reportesmba",
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
  experimental: {
    // Default es 10MB: la exportacion de Excel manda el dataset filtrado completo
    // como JSON en el POST a /api/data/excel. Medido real: 1 mes de Movimientos
    // (con seriales) ya son ~65MB - 300mb cubre varios meses de margen. Debe
    // coincidir con client_max_body_size en deploy.py (nginx tiene su propio
    // limite independiente, delante de esta app). Si a futuro se necesita mas,
    // cambiar el export a mandar inicio/fin y que el backend regenere en vez
    // de mandar las filas ya traidas desde el navegador.
    proxyClientMaxBodySize: "300mb",
  },
};

export default nextConfig;
