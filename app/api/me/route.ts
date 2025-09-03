/**
 * API de test pour vérifier la session utilisateur
 * Endpoint: GET /api/me
 * Retourne la session avec user.id (Google sub)
 */

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    return NextResponse.json({
      session,
      timestamp: new Date().toISOString(),
      // Debug info
      debug: {
        authenticated: !!session,
        userId: session?.user?.id || null,
        userEmail: session?.user?.email || null,
      }
    })
  } catch (error) {
    console.error("Erreur lors de la récupération de la session:", error)
    
    return NextResponse.json(
      { 
        error: "Erreur serveur",
        session: null,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
