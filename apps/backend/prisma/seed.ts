/**
 * Dev seed: one organization, one user per role, and a few items with lots.
 * Password for all seeded users: password123
 * Refuses to run when users already exist.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log('Users already exist — skipping seed.');
    return;
  }

  const passwordHash = await bcrypt.hash('password123', 12);
  const org = await prisma.organization.create({ data: { name: 'StockHV Demo' } });

  const [admin] = await Promise.all([
    prisma.user.create({ data: { organizationId: org.id, email: 'admin@stockhv.local', passwordHash, role: 'ADMIN', displayName: 'ผู้ดูแลระบบ' } }),
    prisma.user.create({ data: { organizationId: org.id, email: 'manager@stockhv.local', passwordHash, role: 'STOCK_MANAGER', displayName: 'ผู้จัดการคลัง' } }),
    prisma.user.create({ data: { organizationId: org.id, email: 'staff@stockhv.local', passwordHash, role: 'STAFF', displayName: 'เจ้าหน้าที่' } }),
  ]);

  const items = [
    { name: 'Paracetamol 500mg', unit: 'เม็ด', category: 'DRUG' as const, qty: 500, threshold: 100, days: 400 },
    { name: 'Amoxicillin 500mg', unit: 'แคปซูล', category: 'DRUG' as const, qty: 60, threshold: 80, days: 20 },
    { name: 'Metformin 500mg', unit: 'เม็ด', category: 'DRUG' as const, qty: 300, threshold: 50, days: 200 },
    { name: 'ผ้าก๊อซ 3x3', unit: 'ซอง', category: 'SUPPLY' as const, qty: 40, threshold: 20, days: 700 },
    { name: 'แอลกอฮอล์ 70%', unit: 'ขวด', category: 'SUPPLY' as const, qty: 8, threshold: 10, days: 365 },
  ];

  for (const i of items) {
    const item = await prisma.inventoryItem.create({
      data: { organizationId: org.id, name: i.name, unit: i.unit, category: i.category, lowStockThreshold: i.threshold, currentStock: i.qty },
    });
    const lot = await prisma.inventoryLot.create({
      data: { itemId: item.id, actorId: admin.id, quantity: i.qty, remaining: i.qty, expiryDate: new Date(Date.now() + i.days * 86_400_000) },
    });
    await prisma.stockTransaction.create({
      data: { itemId: item.id, actorId: admin.id, type: 'IN_PURCHASE', quantity: i.qty, balanceAfter: i.qty, lotId: lot.id },
    });
  }

  console.log('Seeded. Logins: admin@ / manager@ / staff@stockhv.local — password123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
