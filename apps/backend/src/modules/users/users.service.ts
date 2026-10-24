import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true, email: true, displayName: true, role: true, phone: true, isActive: true, createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private audit: AuditLogService) {}

  list(orgId: string) {
    return this.prisma.user.findMany({
      where: { organizationId: orgId },
      select: USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(orgId: string, actorId: string, dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('อีเมลนี้ถูกใช้แล้ว');

    const { password, ...rest } = dto;
    const user = await this.prisma.user.create({
      data: { ...rest, organizationId: orgId, passwordHash: await bcrypt.hash(password, 12) },
      select: USER_SELECT,
    });
    void this.audit.log({ orgId, actorId, action: 'CREATE_USER', entity: 'User', entityId: user.id, detail: `${user.email} (${user.role})` });
    return user;
  }

  async update(id: string, orgId: string, actorId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId: orgId } });
    if (!user) throw new NotFoundException('User not found');
    if (id === actorId && (dto.isActive === false || (dto.role && dto.role !== user.role))) {
      throw new BadRequestException('ไม่สามารถปิดใช้งานหรือเปลี่ยนสิทธิ์ของตนเองได้');
    }

    const { password, ...rest } = dto;
    const updated = await this.prisma.user.update({
      where: { id },
      data: { ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
      select: USER_SELECT,
    });
    const changed = [...Object.keys(rest), ...(password ? ['password'] : [])].join(', ');
    void this.audit.log({ orgId, actorId, action: 'UPDATE_USER', entity: 'User', entityId: id, detail: `${user.email}: ${changed}` });
    return updated;
  }
}
