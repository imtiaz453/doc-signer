import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const stamps = await prisma.stamp.findMany({
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { name: true } } },
  });
  return NextResponse.json(stamps);
}

export async function POST(req) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { name, imageUrl } = await req.json();
    if (!name || !imageUrl) {
      return NextResponse.json({ error: 'Name and imageUrl required' }, { status: 400 });
    }
    const stamp = await prisma.stamp.create({
      data: { name, imageUrl, uploadedById: session.user.id },
    });
    return NextResponse.json(stamp, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
