import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

function decodeJwtExpiry(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload.exp * 1000;
  } catch {
    return Date.now() + 60 * 60 * 1000;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
          cache: 'no-store',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message ?? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        }
        const data = await res.json();
        return { id: credentials.email, ...data };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return {
          ...token,
          accessToken: user.accessToken,
          accessTokenExpires: decodeJwtExpiry(user.accessToken!),
          userId: user.userId,
          role: user.role,
          displayName: user.displayName,
        };
      }
      return token;
    },
    async session({ session, token }) {
      const expired = Date.now() >= (token.accessTokenExpires ?? 0);
      session.accessToken = expired ? undefined : token.accessToken;
      session.userId = token.userId;
      session.role = token.role;
      session.displayName = token.displayName;
      return session;
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};
