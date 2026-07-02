import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      cedula: string;
      role: string;
    }
  }

  interface User {
    id: string;
    name: string | null;
    cedula: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    cedula: string;
    role: string;
  }
}
