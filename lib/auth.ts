/**
 * Helper pour récupérer la session côté serveur
 */

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import type { NextAuthOptions } from "next-auth"

/**
 * Récupère la session côté serveur (RSC, API routes, middleware)
 * @returns Session avec user.id exposé
 */
export async function getSession() {
  return await getServerSession(authOptions)
}

// Export du type pour la réutilisation
export type { NextAuthOptions }
