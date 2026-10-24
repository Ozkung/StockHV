import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch,
  Post, Query, UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { StockInDto } from './dto/stock-in.dto';
import { DeductDto } from './dto/deduct.dto';
import { AdjRequestDto } from './dto/adj-request.dto';
import { ReviewAdjDto } from './dto/review-adj.dto';

const ALL = [UserRole.ADMIN, UserRole.STOCK_MANAGER, UserRole.STAFF];
const MANAGERS = [UserRole.ADMIN, UserRole.STOCK_MANAGER];

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private inventory: InventoryService) {}

  @Get()
  @Roles(...ALL)
  listItems(@CurrentUser() user: JwtPayload, @Query('category') category?: string) {
    return this.inventory.listItems(user.orgId, category);
  }

  @Post()
  @Roles(...MANAGERS)
  createItem(@Body() dto: CreateItemDto, @CurrentUser() user: JwtPayload) {
    return this.inventory.createItem(user.orgId, dto, user.sub);
  }

  @Get('low-stock')
  @Roles(...ALL)
  getLowStock(@CurrentUser() user: JwtPayload) {
    return this.inventory.getLowStockItems(user.orgId);
  }

  @Get('expiring')
  @Roles(...ALL)
  getExpiring(@CurrentUser() user: JwtPayload) {
    return this.inventory.getExpiringLots(user.orgId);
  }

  @Get('adj-requests')
  @Roles(...MANAGERS)
  listAdj(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.inventory.listAdj(user.orgId, status);
  }

  @Patch('adj-requests/:id')
  @Roles(...MANAGERS)
  reviewAdj(@Param('id') id: string, @Body() dto: ReviewAdjDto, @CurrentUser() user: JwtPayload) {
    return this.inventory.reviewAdj(id, user.sub, user.orgId, dto);
  }

  @Post('lots/:lotId/expire')
  @Roles(...MANAGERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  expireLot(@Param('lotId') lotId: string, @CurrentUser() user: JwtPayload) {
    return this.inventory.expireLot(lotId, user.sub, user.orgId);
  }

  @Patch(':id')
  @Roles(...MANAGERS)
  updateItem(@Param('id') id: string, @Body() dto: UpdateItemDto, @CurrentUser() user: JwtPayload) {
    return this.inventory.updateItem(id, user.orgId, dto, user.sub);
  }

  @Delete(':id')
  @Roles(...MANAGERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  archiveItem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.inventory.archiveItem(id, user.orgId, user.sub);
  }

  @Get(':id/lots')
  @Roles(...ALL)
  getLots(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.inventory.getLots(id, user.orgId);
  }

  @Get(':id/transactions')
  @Roles(...ALL)
  getTransactionHistory(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.inventory.getTransactionHistory(id, user.orgId);
  }

  @Post(':id/stock-in')
  @Roles(...MANAGERS)
  @HttpCode(HttpStatus.CREATED)
  stockIn(@Param('id') id: string, @Body() dto: StockInDto, @CurrentUser() user: JwtPayload) {
    return this.inventory.stockIn(id, user.orgId, user.sub, dto);
  }

  @Post(':id/deduct')
  @Roles(...ALL)
  @HttpCode(HttpStatus.OK)
  deduct(@Param('id') id: string, @Body() dto: DeductDto, @CurrentUser() user: JwtPayload) {
    return this.inventory.deduct(id, dto.quantity, {
      actorId: user.sub, orgId: user.orgId, type: dto.type, reference: dto.reference, reason: dto.reason,
    });
  }

  @Post(':id/adj-request')
  @Roles(...MANAGERS)
  @HttpCode(HttpStatus.CREATED)
  requestAdj(@Param('id') id: string, @Body() dto: AdjRequestDto, @CurrentUser() user: JwtPayload) {
    return this.inventory.requestAdj(id, user.orgId, user.sub, user.role, dto);
  }
}
