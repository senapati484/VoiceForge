import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import type { DefaultSession, NextAuthConfig } from 'next-auth';

const API_ROOT = process.env.API_URL || 'http://localhost:4000';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      credits: number;
      plan: string;
    } & DefaultSession['user'];
    backendToken: string;
  }

  interface User {
    id: string;
    credits: number;
    plan: string;
    backendToken: string;
  }
}

export const authOptions: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'Email OTP',
      credentials: {
        type: { label: 'Type', type: 'text' },
        email: { label: 'Email', type: 'email' },
        otp: { label: 'OTP', type: 'text' }
      },
      async authorize(credentials) {
        console.log("[Auth] Authorize called with:", credentials);

        if (credentials?.type !== 'otp' || !credentials?.email || !credentials?.otp) {
          console.log("[Auth] Invalid credentials - missing fields");
          return null;
        }

        try {
          const res = await fetch(`${API_ROOT}/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              otp: credentials.otp
            })
          });

          console.log("[Auth] Backend response status:", res.status);

          if (!res.ok) {
            console.log("[Auth] Backend returned error");
            return null;
          }

          const data = await res.json();
          console.log("[Auth] Backend returned user:", data.user?.email);

          return {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            credits: data.user.credits,
            plan: data.user.plan,
            backendToken: data.token
          };
        } catch (err) {
          console.error("[Auth] Error in authorize:", err);
          return null;
        }
      }
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      console.log("[Auth] JWT callback - user:", user?.email, "trigger:", trigger, "account:", account?.provider);

      // Initial sign in - persist user data to token
      // When authorize() returns a user, NextAuth passes it here
      if (user) {
        console.log("[Auth] Setting token from user data:", user);
        token.backendToken = user.backendToken;
        token.userId = user.id;
        token.credits = user.credits;
        token.plan = user.plan;
        token.email = user.email;
        token.name = user.name;
      }

      // Exchange Google OAuth token with backend JWT for API calls
      if (account?.provider === 'google' && account.id_token) {
        const res = await fetch(`${API_ROOT}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: account.id_token })
        });

        if (res.ok) {
          const data = await res.json();
          token.backendToken = data.token;
          token.userId = data.user.id;
          token.credits = data.user.credits;
          token.plan = data.user.plan;
          token.email = data.user.email;
          token.name = data.user.name;
        }
      }

      return token;
    },
    async session({ session, token }) {
      console.log("[Auth] Session callback - token.userId:", token?.userId);

      if (token) {
        session.user.id = token.userId as string;
        session.user.credits = token.credits as number;
        session.user.plan = token.plan as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.backendToken = token.backendToken as string;
      }

      console.log("[Auth] Session created:", session.user?.email);
      return session;
    },
    async signIn({ account, profile }) {
      if (account?.provider === 'google' && profile?.email) {
        return Boolean(account.id_token);
      }
      return true;
    }
  },
  pages: {
    signIn: '/login',
    error: '/auth/error'
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days - user stays logged in until explicit logout
    updateAge: 24 * 60 * 60 // Update session every 24 hours
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60 // 30 days to match session
  }
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
