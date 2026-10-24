import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, orgId: user.organizationId, displayName: user.displayName },
      { expiresIn: this.config.get('jwt.expiresIn') },
    );
    return { accessToken, userId: user.id, role: user.role, displayName: user.displayName };
  }

  async isSetupDone() {
    const count = await this.prisma.user.count();
    return { setupDone: count > 0 };
  }

  async setup(orgName: string, adminName: string, adminEmail: string, adminPassword: string) {
    const existing = await this.prisma.user.count();
    if (existing > 0) throw new ConflictException('System already set up');

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await this.prisma.organization.create({
      data: {
        name: orgName,
        users: { create: { email: adminEmail, passwordHash, role: 'ADMIN', displayName: adminName } },
      },
    });
    return { message: 'Setup complete' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, displayName: true, role: true, phone: true, createdAt: true,
        organization: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('รหัสผ่านไม่ถูกต้อง');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }
}
