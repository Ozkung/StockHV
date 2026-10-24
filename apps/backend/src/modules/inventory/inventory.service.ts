import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdjStatus, InventoryCategory, Prisma, TransactionType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { StockInDto } from './dto/stock-in.dto';
import { AdjRequestDto } from './dto/adj-request.dto';
import { ReviewAdjDto } from './dto/review-adj.dto';

type Tx = Prisma.TransactionClient;

interface OutboundCtx {
  actorId: string;
  type: TransactionType;
  reference?: string;
  reason?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogService,
    private config: ConfigService,
  ) {}

  // ── Items ────────────────────────────────────────────────────────────────

  async createItem(orgId: string, dto: CreateItemDto, actorId: string) {
    const item = await this.prisma.inventoryItem.create({
      data: { ...dto, organizationId: orgId, lowStockThreshold: dto.lowStockThreshold ?? 10 },
    });
    void this.audit.log({ orgId, actorId, action: 'CREATE_ITEM', entity: 'InventoryItem', entityId: item.id, detail: `${item.name} (${item.unit})` });
    return item;
  }

  async updateItem(itemId: string, orgId: string, dto: UpdateItemDto, actorId: string) {
    const item = await this.findItemOrThrow(itemId, orgId);
    const updated = await this.prisma.inventoryItem.update({ where: { id: itemId }, data: dto });
    void this.audit.log({ orgId, actorId, action: 'UPDATE_ITEM', entity: 'InventoryItem', entityId: item.id, detail: `${item.name}: ${Object.keys(dto).join(', ')}` });
    return updated;
  }

  async archiveItem(itemId: string, orgId: string, actorId: string) {
    const item = await this.findItemOrThrow(itemId, orgId);
    if (item.currentStock > 0) {
      throw new BadRequestException(`ยังมีสต็อกคงเหลือ ${item.currentStock} ${item.unit} — กรุณาปรับยอดเป็น 0 ก่อนเก็บรายการ`);
    }
    await this.prisma.inventoryItem.update({ where: { id: itemId }, data: { isActive: false } });
    void this.audit.log({ orgId, actorId, action: 'ARCHIVE_ITEM', entity: 'InventoryItem', entityId: itemId, detail: item.name });
  }

  listItems(orgId: string, category?: string) {
    const validCategory = Object.values(InventoryCategory).includes(category as InventoryCategory)
      ? (category as InventoryCategory)
      : undefined;
    return this.prisma.inventoryItem.findMany({
      where: { organizationId: orgId, isActive: true, ...(validCategory ? { category: validCategory } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  async getLowStockItems(orgId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return items.filter((i) => i.currentStock <= i.lowStockThreshold);
  }

  // ── Lots ─────────────────────────────────────────────────────────────────

  async getExpiringLots(orgId: string) {
    const days = this.config.get<number>('inventory.expiryWarningDays') ?? 30;
    const cutoff = new Date(Date.now() + days * 86_400_000);
    const lots = await this.prisma.inventoryLot.findMany({
      where: {
        item: { organizationId: orgId, isActive: true },
        isExpired: false,
        remaining: { gt: 0 },
        expiryDate: { lte: cutoff },
      },
      include: { item: { select: { name: true, unit: true } } },
      orderBy: { expiryDate: 'asc' },
    });

    return lots.map((lot) => ({
      lotId: lot.id,
      itemId: lot.itemId,
      itemName: lot.item.name,
      unit: lot.item.unit,
      remaining: lot.remaining,
      expiryDate: lot.expiryDate,
      daysLeft: Math.ceil((lot.expiryDate.getTime() - Date.now()) / 86_400_000),
      unitCost: lot.unitCost,
    }));
  }

  async expireLot(lotId: string, actorId: string, orgId: string) {
    const lot = await this.prisma.inventoryLot.findFirst({
      where: { id: lotId, item: { organizationId: orgId } },
      include: { item: true },
    });
    if (!lot) throw new NotFoundException('Lot not found');
    if (lot.isExpired) throw new BadRequestException('Lot นี้ถูกนำออกไปแล้ว');

    await this.prisma.$transaction(async (tx) => {
      // Lock the item row first, then re-read the lot so a concurrent dispense can't double-count it.
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${lot.itemId} FOR UPDATE`;
      const fresh = await tx.inventoryLot.findUniqueOrThrow({ where: { id: lotId } });
      if (fresh.isExpired) throw new BadRequestException('Lot นี้ถูกนำออกไปแล้ว');

      const item = await tx.inventoryItem.update({
        where: { id: lot.itemId },
        data: { currentStock: { decrement: fresh.remaining } },
      });
      await tx.inventoryLot.update({
        where: { id: lotId },
        data: { isExpired: true, expiredAt: new Date(), expiredById: actorId, remaining: 0 },
      });
      await tx.stockTransaction.create({
        data: {
          itemId: lot.itemId,
          actorId,
          type: 'OUT_EXPIRED',
          quantity: -fresh.remaining,
          balanceAfter: item.currentStock,
          lotId,
          reason: 'หมดอายุ',
        },
      });
    });
    void this.audit.log({ orgId, actorId, action: 'EXPIRE_LOT', entity: 'InventoryLot', entityId: lotId, detail: `${lot.item.name} -${lot.remaining} ${lot.item.unit}` });
  }

  async getLots(itemId: string, orgId: string) {
    await this.findItemOrThrow(itemId, orgId);
    return this.prisma.inventoryLot.findMany({
      where: { itemId },
      include: {
        actor: { select: { displayName: true } },
        expiredBy: { select: { displayName: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  // ── Movements ────────────────────────────────────────────────────────────

  async getTransactionHistory(itemId: string, orgId: string) {
    await this.findItemOrThrow(itemId, orgId);
    return this.prisma.stockTransaction.findMany({
      where: { itemId },
      include: {
        actor: { select: { displayName: true } },
        lot: { select: { expiryDate: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async stockIn(itemId: string, orgId: string, actorId: string, dto: StockInDto) {
    const item = await this.findItemOrThrow(itemId, orgId);

    if (new Date(dto.expiryDate) <= new Date()) {
      throw new BadRequestException('วันหมดอายุต้องเป็นวันในอนาคต');
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryItem.update({
        where: { id: itemId },
        data: { currentStock: { increment: dto.quantity } },
      });
      const lot = await tx.inventoryLot.create({
        data: {
          itemId,
          actorId,
          quantity: dto.quantity,
          remaining: dto.quantity,
          expiryDate: new Date(dto.expiryDate),
          receiptNo: dto.receiptNo,
          donorName: dto.donorName,
          unitCost: dto.unitCost,
        },
      });
      await tx.stockTransaction.create({
        data: {
          itemId,
          actorId,
          type: dto.type,
          quantity: dto.quantity,
          balanceAfter: updated.currentStock,
          donorName: dto.donorName,
          receiptNo: dto.receiptNo,
          unitCost: dto.unitCost,
          lotId: lot.id,
        },
      });
    });
    void this.audit.log({ orgId, actorId, action: 'STOCK_IN', entity: 'InventoryItem', entityId: itemId, detail: `${item.name} +${dto.quantity} ${item.unit}${dto.receiptNo ? ` (${dto.receiptNo})` : ''}` });
  }

  async deduct(
    itemId: string,
    qty: number,
    ctx: { actorId: string; orgId: string; type: 'OUT_PRESCRIPTION' | 'OUT_SUPPLY'; reference?: string; reason?: string },
  ) {
    const item = await this.findItemOrThrow(itemId, ctx.orgId);

    const balanceAfter = await this.prisma.$transaction((tx) =>
      this.takeOut(tx, itemId, qty, { actorId: ctx.actorId, type: ctx.type, reference: ctx.reference, reason: ctx.reason }),
    );

    void this.audit.log({ orgId: ctx.orgId, actorId: ctx.actorId, action: 'DEDUCT', entity: 'InventoryItem', entityId: itemId, detail: `${item.name} -${qty} ${item.unit}${ctx.reference ? ` → ${ctx.reference}` : ''}` });
    return { balanceAfter, lowStock: balanceAfter <= item.lowStockThreshold };
  }

  // ── Adjustments ──────────────────────────────────────────────────────────

  async requestAdj(itemId: string, orgId: string, actorId: string, actorRole: string, dto: AdjRequestDto) {
    const item = await this.findItemOrThrow(itemId, orgId);
    if (item.currentStock + dto.quantity < 0) {
      throw new BadRequestException(`ปรับลดเกินสต็อกคงเหลือ (มี ${item.currentStock} ${item.unit})`);
    }

    const limit = this.config.get<number>('inventory.adjAutoApproveLimit') ?? 20;
    // ADMIN's own adjustments never need a second approver — apply immediately.
    if (actorRole === UserRole.ADMIN || Math.abs(dto.quantity) <= limit) {
      await this.prisma.$transaction((tx) => this.applyAdjustment(tx, itemId, actorId, dto.quantity, dto.reason));
      void this.audit.log({ orgId, actorId, action: 'ADJ_APPLIED', entity: 'InventoryItem', entityId: itemId, detail: `${item.name} ${this.signed(dto.quantity)} ${item.unit}: ${dto.reason}` });
      return { autoApproved: true };
    }

    const adj = await this.prisma.adjRequest.create({
      data: { itemId, requestedById: actorId, quantity: dto.quantity, reason: dto.reason },
    });
    void this.audit.log({ orgId, actorId, action: 'ADJ_REQUESTED', entity: 'AdjRequest', entityId: adj.id, detail: `${item.name} ${this.signed(dto.quantity)} ${item.unit}: ${dto.reason}` });
    return { autoApproved: false, adjId: adj.id };
  }

  listAdj(orgId: string, status?: string) {
    const validStatus = Object.values(AdjStatus).includes(status as AdjStatus) ? (status as AdjStatus) : undefined;
    return this.prisma.adjRequest.findMany({
      where: { item: { organizationId: orgId }, ...(status === 'ALL' ? {} : { status: validStatus ?? 'PENDING' }) },
      include: {
        item: { select: { name: true, unit: true, currentStock: true } },
        requester: { select: { displayName: true } },
        reviewer: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async reviewAdj(adjId: string, reviewerId: string, orgId: string, dto: ReviewAdjDto) {
    const adj = await this.prisma.adjRequest.findFirst({
      where: { id: adjId, item: { organizationId: orgId }, status: 'PENDING' },
      include: { item: true },
    });
    if (!adj) throw new NotFoundException('AdjRequest not found');
    if (adj.requestedById === reviewerId) {
      throw new BadRequestException('ไม่สามารถอนุมัติคำขอของตนเองได้');
    }

    await this.prisma.$transaction(async (tx) => {
      // Conditional update so two reviewers can't both act on the same request.
      const claimed = await tx.adjRequest.updateMany({
        where: { id: adjId, status: 'PENDING' },
        data: { status: dto.status, reviewedById: reviewerId, reviewNote: dto.reviewNote },
      });
      if (claimed.count === 0) throw new BadRequestException('คำขอนี้ถูกพิจารณาไปแล้ว');
      if (dto.status === 'APPROVED') {
        await this.applyAdjustment(tx, adj.itemId, reviewerId, adj.quantity, adj.reason);
      }
    });
    void this.audit.log({ orgId, actorId: reviewerId, action: `ADJ_${dto.status}`, entity: 'AdjRequest', entityId: adjId, detail: `${adj.item.name} ${this.signed(adj.quantity)} ${adj.item.unit}` });
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async applyAdjustment(tx: Tx, itemId: string, actorId: string, quantity: number, reason: string) {
    if (quantity < 0) {
      // Negative adjustments consume lots FIFO so lot balances stay in step with currentStock.
      return this.takeOut(tx, itemId, -quantity, { actorId, type: 'ADJ_APPROVED', reason });
    }
    const updated = await tx.inventoryItem.update({
      where: { id: itemId },
      data: { currentStock: { increment: quantity } },
    });
    await tx.stockTransaction.create({
      data: { itemId, actorId, type: 'ADJ_APPROVED', quantity, balanceAfter: updated.currentStock, reason },
    });
    return updated.currentStock;
  }

  /**
   * Atomically removes `qty` from an item, drawing from the earliest-expiring lots first.
   * One StockTransaction is written per lot touched; any shortfall in lot balances
   * (e.g. stock added via positive adjustment) is recorded as a lot-less transaction.
   * Returns the item's balance after the removal.
   */
  private async takeOut(tx: Tx, itemId: string, qty: number, ctx: OutboundCtx): Promise<number> {
    const res = await tx.inventoryItem.updateMany({
      where: { id: itemId, currentStock: { gte: qty } },
      data: { currentStock: { decrement: qty } },
    });
    if (res.count === 0) {
      const current = await tx.inventoryItem.findUnique({ where: { id: itemId }, select: { currentStock: true } });
      throw new BadRequestException(`สต็อกไม่พอ (มี ${current?.currentStock ?? 0} หน่วย)`);
    }

    const lots = await tx.inventoryLot.findMany({
      where: { itemId, isExpired: false, remaining: { gt: 0 } },
      orderBy: { expiryDate: 'asc' },
    });

    const { currentStock: balanceAfter } = await tx.inventoryItem.findUniqueOrThrow({
      where: { id: itemId }, select: { currentStock: true },
    });

    let toTake = qty;
    let running = balanceAfter + qty;
    const base = { itemId, actorId: ctx.actorId, type: ctx.type, reference: ctx.reference, reason: ctx.reason };

    for (const lot of lots) {
      if (toTake === 0) break;
      const take = Math.min(lot.remaining, toTake);
      running -= take;
      await tx.inventoryLot.update({ where: { id: lot.id }, data: { remaining: { decrement: take } } });
      await tx.stockTransaction.create({ data: { ...base, quantity: -take, balanceAfter: running, lotId: lot.id } });
      toTake -= take;
    }
    if (toTake > 0) {
      await tx.stockTransaction.create({ data: { ...base, quantity: -toTake, balanceAfter } });
    }
    return balanceAfter;
  }

  private signed(n: number) {
    return n > 0 ? `+${n}` : `${n}`;
  }

  private async findItemOrThrow(itemId: string, orgId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, organizationId: orgId, isActive: true },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }
}
