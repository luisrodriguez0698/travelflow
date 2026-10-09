import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { ALL_MODULES, resolvePermissionList } from './permissions';
import { rateLimit } from './rate-limit';

// Permisos efectivos de la sesion: "ventas" (ver) + "ventas:create", etc.
function resolvePermissions(user: { role: string; roleRef: { permissions: unknown } | null }): string[] {
  return user.roleRef
    ? resolvePermissionList(user.roleRef.permissions)
    : user.role === 'ADMIN'
      ? resolvePermissionList([...ALL_MODULES])
      : [];
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Rate limit: 10 intentos por email cada 15 minutos
        const rl = rateLimit(`login:${credentials.email.toLowerCase()}`, 10, 15 * 60 * 1000);
        if (!rl.allowed) {
          throw new Error(`Demasiados intentos. Intenta de nuevo en ${rl.retryAfterSeconds} segundos.`);
        }

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: { tenant: true, roleRef: true },
          });
        } catch (error) {
          // El mensaje de error llega a la pantalla de login: nunca exponer detalles internos
          console.error('Login DB error:', error);
          throw new Error('No se pudo iniciar sesión en este momento. Intenta de nuevo en unos minutos.');
        }

        // Usuarios eliminados (borrado logico) se tratan como inexistentes
        if (!user || user.deletedAt) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        if (!user.isActive) {
          throw new Error('Tu usuario está desactivado. Contacta al administrador de tu agencia.');
        }

        // Get permissions from role, fallback to all for legacy ADMIN users
        const permissions = resolvePermissions(user);
        const ownDataOnly = user.roleRef?.ownDataOnly ?? false;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
          role: user.role,
          permissions,
          ownDataOnly,
          avatar: user.avatar,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = (user as any).tenantId;
        token.tenantName = (user as any).tenantName;
        token.role = (user as any).role;
        token.permissions = (user as any).permissions;
        token.ownDataOnly = (user as any).ownDataOnly;
        token.avatar = (user as any).avatar ?? null;
      } else if (token.id) {
        // Re-read permissions from the DB on every session check so role edits
        // take effect immediately instead of only after the next login.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: { roleRef: true },
        });
        if (!dbUser || dbUser.deletedAt || !dbUser.isActive) {
          // Desactivado o eliminado: se invalida la sesion sin esperar a que expire
          token.disabled = true;
          token.permissions = [];
          delete token.tenantId;
        } else {
          token.disabled = false;
          token.tenantId = dbUser.tenantId;
          // Nombre/correo pueden cambiar desde Mi perfil
          token.name = dbUser.name;
          token.email = dbUser.email;
          token.avatar = dbUser.avatar ?? null;
          token.role = dbUser.role;
          token.permissions = resolvePermissions(dbUser);
          token.ownDataOnly = dbUser.roleRef?.ownDataOnly ?? false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).tenantName = token.tenantName;
        (session.user as any).role = token.role;
        (session.user as any).permissions = token.permissions;
        (session.user as any).disabled = token.disabled ?? false;
        (session.user as any).ownDataOnly = token.ownDataOnly ?? false;
        (session.user as any).avatar = token.avatar ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
};
