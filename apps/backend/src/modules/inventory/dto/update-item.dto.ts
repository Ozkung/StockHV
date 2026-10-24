import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { InventoryCategory } from '@prisma/client';

export class UpdateItemDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() @MinLength(1) unit?: string;
  @IsOptional() @IsEnum(InventoryCategory) category?: InventoryCategory;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
}
