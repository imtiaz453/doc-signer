import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const logs = await prisma.stampLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { name: true } },
      stamp: { select: { name: true } },
    },
  });
  return NextResponse.json(logs);
}

export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { stampId, documentName, pageNumber } = await req.json();
    const log = await prisma.stampLog.create({
      data: { userId: session.user.id, stampId, documentName: documentName || 'Untitled', pageNumber: pageNumber || 1 },
    });
    return NextResponse.json(log, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
