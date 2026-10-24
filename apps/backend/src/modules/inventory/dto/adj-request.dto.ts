import { IsInt, IsNotEmpty, IsString, NotEquals } from 'class-validator';

export class AdjRequestDto {
  @IsInt() @NotEquals(0) quantity!: number;
  @IsString() @IsNotEmpty() reason!: string;
}
