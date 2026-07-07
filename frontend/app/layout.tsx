import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
