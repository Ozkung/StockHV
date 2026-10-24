import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from '../inventory.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

const mockPrisma: any = {
  inventoryItem: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  inventoryLot: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  stockTransaction: { create: jest.fn(), findMany: jest.fn() },
  adjRequest: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
  $queryRaw: jest.fn(),
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockConfig = { get: (key: string) => ({ 'inventory.adjAutoApproveLimit': 20, 'inventory.expiryWarningDays': 30 } as any)[key] };

const ITEM = { id: 'item1', name: 'Metformin', unit: 'เม็ด', currentStock: 100, lowStockThreshold: 10, organizationId: 'org1', isActive: true };

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAudit },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(InventoryService);
    mockPrisma.inventoryItem.findFirst.mockResolvedValue(ITEM);
  });

  describe('stockIn', () => {
    it('increments stock and records a lot + transaction with the new balance', async () => {
      mockPrisma.inventoryItem.update.mockResolvedValue({ ...ITEM, currentStock: 150 });
      mockPrisma.inventoryLot.create.mockResolvedValue({ id: 'lot1' });

      await service.stockIn('item1', 'org1', 'user1', {
        type: 'IN_PURCHASE', quantity: 50, expiryDate: '2099-01-01', receiptNo: 'RX-001', unitCost: 2.5,
      });

      expect(mockPrisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'item1' }, data: { currentStock: { increment: 50 } },
      });
      expect(mockPrisma.inventoryLot.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ quantity: 50, remaining: 50, expiryDate: new Date('2099-01-01') }),
      }));
      expect(mockPrisma.stockTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ type: 'IN_PURCHASE', quantity: 50, balanceAfter: 150, lotId: 'lot1' }),
      }));
    });

    it('rejects an expiry date in the past', async () => {
      await expect(service.stockIn('item1', 'org1', 'user1', {
        type: 'IN_PURCHASE', quantity: 5, expiryDate: '2000-01-01',
      })).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound for an item outside the org', async () => {
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
      await expect(service.stockIn('x', 'org1', 'user1', {
        type: 'IN_PURCHASE', quantity: 5, expiryDate: '2099-01-01',
      })).rejects.toThrow(NotFoundException);
    });
  });

  describe('deduct', () => {
    it('draws from the earliest-expiring lots first (FIFO)', async () => {
      mockPrisma.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.inventoryItem.findUniqueOrThrow.mockResolvedValue({ currentStock: 70 });
      mockPrisma.inventoryLot.findMany.mockResolvedValue([
        { id: 'lotA', remaining: 20 },
        { id: 'lotB', remaining: 80 },
      ]);

      const res = await service.deduct('item1', 30, { actorId: 'u1', orgId: 'org1', type: 'OUT_PRESCRIPTION', reference: 'HN-1' });

      expect(res).toEqual({ balanceAfter: 70, lowStock: false });
      expect(mockPrisma.inventoryItem.updateMany).toHaveBeenCalledWith({
        where: { id: 'item1', currentStock: { gte: 30 } }, data: { currentStock: { decrement: 30 } },
      });
      expect(mockPrisma.inventoryLot.update).toHaveBeenNthCalledWith(1, { where: { id: 'lotA' }, data: { remaining: { decrement: 20 } } });
      expect(mockPrisma.inventoryLot.update).toHaveBeenNthCalledWith(2, { where: { id: 'lotB' }, data: { remaining: { decrement: 10 } } });
      expect(mockPrisma.stockTransaction.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
        data: expect.objectContaining({ quantity: -20, balanceAfter: 80, lotId: 'lotA', reference: 'HN-1' }),
      }));
      expect(mockPrisma.stockTransaction.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
        data: expect.objectContaining({ quantity: -10, balanceAfter: 70, lotId: 'lotB' }),
      }));
    });

    it('records a lot-less transaction for any shortfall in lot balances', async () => {
      mockPrisma.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.inventoryItem.findUniqueOrThrow.mockResolvedValue({ currentStock: 90 });
      mockPrisma.inventoryLot.findMany.mockResolvedValue([{ id: 'lotA', remaining: 4 }]);

      await service.deduct('item1', 10, { actorId: 'u1', orgId: 'org1', type: 'OUT_SUPPLY' });

      expect(mockPrisma.stockTransaction.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.stockTransaction.create).toHaveBeenLastCalledWith(expect.objectContaining({
        data: expect.objectContaining({ quantity: -6, balanceAfter: 90 }),
      }));
    });

    it('rejects when stock is insufficient', async () => {
      mockPrisma.inventoryItem.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.inventoryItem.findUnique.mockResolvedValue({ currentStock: 3 });

      await expect(service.deduct('item1', 5, { actorId: 'u1', orgId: 'org1', type: 'OUT_SUPPLY' }))
        .rejects.toThrow(BadRequestException);
      expect(mockPrisma.stockTransaction.create).not.toHaveBeenCalled();
    });

    it('flags low stock when the balance falls to the threshold', async () => {
      mockPrisma.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.inventoryItem.findUniqueOrThrow.mockResolvedValue({ currentStock: 10 });
      mockPrisma.inventoryLot.findMany.mockResolvedValue([{ id: 'lotA', remaining: 100 }]);

      const res = await service.deduct('item1', 90, { actorId: 'u1', orgId: 'org1', type: 'OUT_SUPPLY' });
      expect(res.lowStock).toBe(true);
    });
  });

  describe('requestAdj', () => {
    it('applies small adjustments immediately', async () => {
      mockPrisma.inventoryItem.update.mockResolvedValue({ ...ITEM, currentStock: 105 });

      const res = await service.requestAdj('item1', 'org1', 'u1', 'STOCK_MANAGER', { quantity: 5, reason: 'นับเกิน' });

      expect(res).toEqual({ autoApproved: true });
      expect(mockPrisma.stockTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ type: 'ADJ_APPROVED', quantity: 5, balanceAfter: 105 }),
      }));
      expect(mockPrisma.adjRequest.create).not.toHaveBeenCalled();
    });

    it('creates a pending request for large adjustments by a stock manager', async () => {
      mockPrisma.adjRequest.create.mockResolvedValue({ id: 'adj1' });

      const res = await service.requestAdj('item1', 'org1', 'u1', 'STOCK_MANAGER', { quantity: -50, reason: 'ชำรุด' });

      expect(res).toEqual({ autoApproved: false, adjId: 'adj1' });
      expect(mockPrisma.inventoryItem.update).not.toHaveBeenCalled();
      expect(mockPrisma.inventoryItem.updateMany).not.toHaveBeenCalled();
    });

    it('lets ADMIN apply large adjustments immediately, consuming lots for negatives', async () => {
      mockPrisma.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.inventoryItem.findUniqueOrThrow.mockResolvedValue({ currentStock: 50 });
      mockPrisma.inventoryLot.findMany.mockResolvedValue([{ id: 'lotA', remaining: 100 }]);

      const res = await service.requestAdj('item1', 'org1', 'admin', 'ADMIN', { quantity: -50, reason: 'ตรวจนับ' });

      expect(res).toEqual({ autoApproved: true });
      expect(mockPrisma.inventoryLot.update).toHaveBeenCalledWith({ where: { id: 'lotA' }, data: { remaining: { decrement: 50 } } });
    });

    it('refuses to adjust below zero', async () => {
      await expect(service.requestAdj('item1', 'org1', 'u1', 'ADMIN', { quantity: -101, reason: 'x' }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('reviewAdj', () => {
    const ADJ = { id: 'adj1', itemId: 'item1', requestedById: 'u1', quantity: 40, reason: 'r', item: ITEM };

    it('forbids reviewing your own request', async () => {
      mockPrisma.adjRequest.findFirst.mockResolvedValue(ADJ);
      await expect(service.reviewAdj('adj1', 'u1', 'org1', { status: 'APPROVED' })).rejects.toThrow(BadRequestException);
    });

    it('applies the adjustment on approval', async () => {
      mockPrisma.adjRequest.findFirst.mockResolvedValue(ADJ);
      mockPrisma.adjRequest.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.inventoryItem.update.mockResolvedValue({ ...ITEM, currentStock: 140 });

      await service.reviewAdj('adj1', 'u2', 'org1', { status: 'APPROVED' });

      expect(mockPrisma.inventoryItem.update).toHaveBeenCalledWith({ where: { id: 'item1' }, data: { currentStock: { increment: 40 } } });
    });

    it('does not touch stock on rejection', async () => {
      mockPrisma.adjRequest.findFirst.mockResolvedValue(ADJ);
      mockPrisma.adjRequest.updateMany.mockResolvedValue({ count: 1 });

      await service.reviewAdj('adj1', 'u2', 'org1', { status: 'REJECTED', reviewNote: 'no' });

      expect(mockPrisma.inventoryItem.update).not.toHaveBeenCalled();
      expect(mockPrisma.stockTransaction.create).not.toHaveBeenCalled();
    });

    it('fails if another reviewer already acted', async () => {
      mockPrisma.adjRequest.findFirst.mockResolvedValue(ADJ);
      mockPrisma.adjRequest.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.reviewAdj('adj1', 'u2', 'org1', { status: 'APPROVED' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('expireLot', () => {
    it('removes the remaining lot quantity from stock', async () => {
      mockPrisma.inventoryLot.findFirst.mockResolvedValue({ id: 'lot1', itemId: 'item1', remaining: 12, isExpired: false, item: ITEM });
      mockPrisma.inventoryLot.findUniqueOrThrow.mockResolvedValue({ id: 'lot1', remaining: 12, isExpired: false });
      mockPrisma.inventoryItem.update.mockResolvedValue({ ...ITEM, currentStock: 88 });

      await service.expireLot('lot1', 'u1', 'org1');

      expect(mockPrisma.inventoryItem.update).toHaveBeenCalledWith({ where: { id: 'item1' }, data: { currentStock: { decrement: 12 } } });
      expect(mockPrisma.stockTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ type: 'OUT_EXPIRED', quantity: -12, balanceAfter: 88 }),
      }));
    });

    it('rejects an already-expired lot', async () => {
      mockPrisma.inventoryLot.findFirst.mockResolvedValue({ id: 'lot1', isExpired: true, item: ITEM });
      await expect(service.expireLot('lot1', 'u1', 'org1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('archiveItem', () => {
    it('refuses while stock remains', async () => {
      await expect(service.archiveItem('item1', 'org1', 'u1')).rejects.toThrow(BadRequestException);
    });
  });
});
