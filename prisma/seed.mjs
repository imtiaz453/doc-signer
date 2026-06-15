import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: 'rayyanalk@pgfci.com' } });
  if (existing) {
    console.log('Admin user already exists, skipping seed.');
  } else {
    const hashed = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        name: 'Rayyan Al-K',
        email: 'rayyanalk@pgfci.com',
        password: hashed,
        role: 'ADMIN',
      },
    });
    console.log('Admin user seeded: rayyanalk@pgfci.com / admin123');
  }

  await prisma.setting.upsert({
    where: { key: 'showSignatures' },
    update: {},
    create: { key: 'showSignatures', value: 'true' },
  });
  console.log('Default settings ensured.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
