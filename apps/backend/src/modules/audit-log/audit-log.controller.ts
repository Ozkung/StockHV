import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditLogController {
  constructor(private auditLog: AuditLogService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLog.findAll(user.orgId, Number(skip ?? 0) || 0, Number(limit ?? 50) || 50);
  }
}
