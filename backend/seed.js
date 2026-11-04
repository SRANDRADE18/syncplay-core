const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 1); // 1 month premium
  const hashedPassword = await bcrypt.hash('123456', 10);

  const user = await prisma.user.upsert({
    where: { email: 'test@syncplay.com' },
    update: {
      name: 'Luna Martins',
      password: hashedPassword,
      referral_code: 'LUNA30',
      premium_until: futureDate
    },
    create: {
      name: 'Luna Martins',
      email: 'test@syncplay.com',
      password: hashedPassword,
      referral_code: 'LUNA30',
      premium_until: futureDate
    }
  });


  const token = jwt.sign(
    { id: user.id, email: user.email }, 
    process.env.JWT_SECRET, 
    { expiresIn: '7d' }
  );

  console.log('--- TEST USER CREATED ---');
  console.log('ID:', user.id);
  console.log('Premium Until:', user.premium_until);
  console.log('JWT_TOKEN:', token);
  console.log('-------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
