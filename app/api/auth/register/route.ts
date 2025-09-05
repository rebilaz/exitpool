import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

// ⚠️ adapte l'import selon où est exposé ton prisma
import { prisma } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'EMAIL_PASSWORD_REQUIRED' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: false, error: 'EMAIL_ALREADY_USED' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[register] error', e);
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
