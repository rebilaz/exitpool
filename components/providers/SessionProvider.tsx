/**
 * Wrapper client pour SessionProvider NextAuth
 * Nécessaire car SessionProvider doit être un composant client
 */

"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  );
}
