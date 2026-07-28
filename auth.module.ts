import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { environment } from '../config/environment';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: environment.jwtSecret,
      signOptions: { expiresIn: environment.jwtExpiresIn as never },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
