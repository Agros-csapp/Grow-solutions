import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
class LoginDto { @IsEmail() email!: string; @IsString() @MinLength(8) password!: string; }
@ApiTags('auth')
@Controller('auth')
export class AuthController { constructor(private readonly service: AuthService) {} @Public() @Post('login') login(@Body() dto: LoginDto) { return this.service.login(dto.email,dto.password); } }
