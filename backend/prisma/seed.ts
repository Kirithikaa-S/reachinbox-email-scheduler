import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_USER_EMAIL ?? 'demo@example.com';

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      googleId: 'seed-google-id',
      name: 'Demo User',
      email,
      avatar: null,
    },
    update: {},
  });

  const etherealUser = process.env.ETHEREAL_USER ?? '';
  const etherealPassword = process.env.ETHEREAL_PASSWORD ?? '';

  if (!etherealUser || !etherealPassword) {
    console.warn(
      'ETHEREAL_USER / ETHEREAL_PASSWORD not set - creating a placeholder sender. ' +
        'Fill in real Ethereal credentials (https://ethereal.email) before sending.'
    );
  }

  const existingSender = await prisma.sender.findFirst({ where: { userId: user.id } });
  if (!existingSender) {
    await prisma.sender.create({
      data: {
        userId: user.id,
        email: 'sender@ethereal.email',
        name: 'ReachInbox Demo Sender',
        etherealUser,
        etherealPassword,
      },
    });
  }

  console.log(`Seeded user ${user.email} with a default sender.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
