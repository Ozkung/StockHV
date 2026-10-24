import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StockInDto {
  @IsEnum(['IN_PURCHASE', 'IN_DONATION']) type!: 'IN_PURCHASE' | 'IN_DONATION';
  @IsInt() @Min(1) quantity!: number;
  @IsDateString() expiryDate!: string;
  @IsOptional() @IsString() donorName?: string;
  @IsOptional() @IsString() receiptNo?: string;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
}
