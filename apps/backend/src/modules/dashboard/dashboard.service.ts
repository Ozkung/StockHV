import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

  async getStats(orgId: string, from: Date, to: Date) {
    const days = this.config.get<number>('inventory.expiryWarningDays') ?? 30;
    const expiryCutoff = new Date(Date.now() + days * 86_400_000);
    const itemScope = { organizationId: orgId, isActive: true };

    const [items, pendingAdjCount, expiringLotCount, movements] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: itemScope,
        select: { id: true, name: true, unit: true, category: true, currentStock: true, lowStockThreshold: true },
      }),
      this.prisma.adjRequest.count({ where: { item: itemScope, status: 'PENDING' } }),
      this.prisma.inventoryLot.count({
        where: { item: itemScope, isExpired: false, remaining: { gt: 0 }, expiryDate: { lte: expiryCutoff } },
      }),
      this.prisma.stockTransaction.groupBy({
        by: ['type'],
        where: { item: itemScope, createdAt: { gte: from, lte: to } },
        _sum: { quantity: true },
        _count: true,
      }),
    ]);

    const lowStock = items
      .filter((i) => i.currentStock <= i.lowStockThreshold)
      .sort((a, b) => a.currentStock / Math.max(a.lowStockThreshold, 1) - b.currentStock / Math.max(b.lowStockThreshold, 1));

    return {
      itemCount: items.length,
      lowStockCount: lowStock.length,
      pendingAdjCount,
      expiringLotCount,
      lowStockItems: lowStock.slice(0, 15),
      movements: movements.map((m) => ({ type: m.type, count: m._count, quantity: m._sum.quantity ?? 0 })),
    };
  }
}
