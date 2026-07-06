import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: {
    signIn: "/auth/login",
  },
});

export const config = {
  // Protege la ruta /dashboard y todas sus subrutas
  matcher: ["/dashboard/:path*"],
};
