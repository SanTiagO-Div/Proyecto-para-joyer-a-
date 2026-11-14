import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  for (const [name, description] of [
    ['ADMIN', 'Acceso total a las funciones administrativas.'],
    ['EDITOR', 'Gestiona productos y categorías.'],
  ]) {
    await prisma.role.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    });
  }

  for (const [name, slug] of [
    ['Anillos', 'anillos'],
    ['Collares', 'collares'],
    ['Aretes', 'aretes'],
  ]) {
    await prisma.category.upsert({
      where: { slug },
      update: { name, isActive: true },
      create: { name, slug },
    });
  }
} finally {
  await prisma.$disconnect();
}
