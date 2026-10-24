import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    userId?: string;
    role?: string;
    displayName?: string;
  }
  interface User {
    accessToken?: string;
    userId?: string;
    role?: string;
    displayName?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    userId?: string;
    accessTokenExpires?: number;
    role?: string;
    displayName?: string;
  }
}
