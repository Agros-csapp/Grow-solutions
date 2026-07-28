import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Store } from '../common/store';
import { environment } from '../config/environment';
import { newId } from '../common/id';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService, private readonly store: Store) {}

  async seedAdmin(): Promise<void> {
    if (!environment.seedAdmin || this.store.users.length) return;

    const companyId = newId();
    this.store.addCompany({
      id: companyId,
      legalName: 'AGROS Demo SAS',
      taxIdentifier: 'DEMO-001',
      countryCode: 'CO',
    });

    const user = {
      id: newId(),
      companyId,
      email: environment.seedAdminEmail.toLowerCase(),
      roles: ['ADMIN', 'TECHNICAL_DIRECTOR'] as const,
    };
    const passwordHash = await bcrypt.hash(environment.seedAdminPassword, 12);
    this.store.addUser({ ...user, roles: [...user.roles], passwordHash });
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = this.store.users.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);
    const hash = user ? this.store.passwordHashes.get(user.id) : undefined;

    if (!user || !hash || !(await bcrypt.compare(password, hash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return {
      accessToken: await this.jwt.signAsync({
        sub: user.id,
        companyId: user.companyId,
        email: user.email,
        roles: user.roles,
      }),
      user,
    };
  }
}
