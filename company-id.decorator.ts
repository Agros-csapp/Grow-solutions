import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../common/types';
type AuthenticatedRequest = Request & { user?: AuthUser };
export const CompanyId = createParamDecorator((_data:unknown,ctx:ExecutionContext):string=>{
  const request=ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if(!request.user?.companyId) throw new UnauthorizedException('Contexto empresarial ausente');
  return request.user.companyId;
});
