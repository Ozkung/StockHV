import { IsEmail, IsString, MinLength } from 'class-validator';

export class SetupDto {
  @IsString() @MinLength(1) orgName!: string;
  @IsString() @MinLength(1) adminName!: string;
  @IsEmail() adminEmail!: string;
  @IsString() @MinLength(8) adminPassword!: string;
}
