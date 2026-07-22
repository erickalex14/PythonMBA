import type { Metadata } from "next";
import { Manrope, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "MBA3 BI Corporate Dashboard",
  description: "Enterprise Business Intelligence and Reporting System integrated with MBA3 ERP",
};

// Render dinámico en TODAS las rutas: sin esto Next prerenderiza las páginas
// y las sirve con "Cache-Control: s-maxage=31536000", que los proxies
// intermedios de la red cachean por 1 año, pisando el no-store del middleware.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${manrope.variable} ${sourceSans.variable}`}>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
