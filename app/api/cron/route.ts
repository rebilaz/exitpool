import { NextResponse } from "next/server";

// tes créneaux horaires (UTC par défaut sur Vercel)
const SCHEDULE = [
  { hour: 8, text: "☕️ Bonjour, voici le tweet #1" },
  { hour: 10, text: "💡 Astuce du matin (#2)" },
  { hour: 12, text: "🍔 Pause de midi (#3)" },
  { hour: 14, text: "📊 Analyse rapide (#4)" },
  { hour: 16, text: "⚡️ Info flash (#5)" },
  { hour: 18, text: "🌇 Fin de journée (#6)" },
  { hour: 21, text: "🌙 Tweet du soir (#7)" }
];

export async function GET() {
  const now = new Date();
  const hour = now.getUTCHours();

  // On regarde si un tweet est prévu à cette heure
  const slot = SCHEDULE.find(s => s.hour === hour);

  if (slot) {
    await tweet(slot.text);
    return NextResponse.json({ ok: true, message: `Tweet envoyé à ${hour}h` });
  }

  return NextResponse.json({ ok: true, message: "Aucun tweet prévu cette heure" });
}

// Fonction tweet (à brancher sur Twitter API)
async function tweet(text: string) {
  console.log("Tweet envoyé:", text);
  // const client = new TwitterApi(process.env.TWITTER_BEARER!);
  // await client.v2.tweet(text);
}
