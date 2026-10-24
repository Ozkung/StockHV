import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) displayName!: string;
  @IsEnum(UserRole) role!: UserRole;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() phone?: string;
}
