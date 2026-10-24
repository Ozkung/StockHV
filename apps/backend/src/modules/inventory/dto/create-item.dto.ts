import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { InventoryCategory } from '@prisma/client';

export class CreateItemDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) unit!: string;
  @IsEnum(InventoryCategory) category!: InventoryCategory;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
}
