import jwt from 'jsonwebtoken';

export async function GET() {
  const nonce = crypto.randomUUID();
  const token = jwt.sign(
    { n: nonce, exp: Math.floor(Date.now() / 1000) + 5 * 60 },
    process.env.NEXTAUTH_SECRET!
  );
  return new Response(JSON.stringify({ nonce, token }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
