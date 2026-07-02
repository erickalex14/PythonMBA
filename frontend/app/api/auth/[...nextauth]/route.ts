import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        cedula: { label: "Cédula", type: "text" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.cedula || !credentials?.password) {
          throw new Error("Por favor, ingrese la cédula y la contraseña.");
        }

        // Consultar el usuario en la base de datos por Cédula, incluyendo su rol y permisos
        const user = await prisma.user.findUnique({
          where: { cedula: credentials.cedula },
          include: {
            role: {
              include: {
                permissions: true
              }
            }
          }
        });

        if (!user) {
          throw new Error("El número de cédula ingresado no está registrado.");
        }

        // Comparar contraseña cifrada
        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error("Contraseña incorrecta.");
        }

        // Retornar información del usuario autorizada para guardar en sesión
        return {
          id: user.id,
          name: user.name,
          cedula: user.cedula,
          role: user.role.name,
          permissions: user.role.permissions.map((p) => p.action),
        } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.cedula = (user as any).cedula;
        token.role = (user as any).role;
        token.permissions = (user as any).permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).cedula = token.cedula;
        (session.user as any).role = token.role;
        (session.user as any).permissions = token.permissions;
      }
      return session;
    }
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
