import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get()
  getStats(@CurrentUser() user: JwtPayload, @Query('from') from?: string, @Query('to') to?: string) {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 86_400_000);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) throw new BadRequestException('Invalid date range');
    return this.dashboard.getStats(user.orgId, fromDate, toDate);
  }
}
