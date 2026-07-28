import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompanyId } from '../auth/company-id.decorator';
import { AuditService } from './audit.service';
@ApiTags('audit') @ApiBearerAuth() @Controller('audit')
export class AuditController { constructor(private readonly service:AuditService){} @Get() list(@CompanyId() companyId:string){ return this.service.list(companyId); } }
