import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class DeductDto {
  @IsInt() @Min(1) quantity!: number;
  @IsEnum(['OUT_PRESCRIPTION', 'OUT_SUPPLY']) type!: 'OUT_PRESCRIPTION' | 'OUT_SUPPLY';
  /** Who/what the stock went to — e.g. patient HN, event or department. */
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() reason?: string;
}
