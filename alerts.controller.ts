import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { CompanyId } from '../auth/company-id.decorator';
import { AlertSeverity } from '../common/types';
import { AlertsService } from './alerts.service';
class AlertDto { @IsString() upiId!:string; @IsString() type!:string; @IsIn(['INFORMATIONAL','PREVENTIVE','MEDIUM','HIGH','CRITICAL']) severity!:AlertSeverity; @IsString() title!:string; @IsString() description!:string; @IsString() sourceType!:string; @IsString() sourceId!:string; }
@ApiTags('alerts') @ApiBearerAuth() @Controller('alerts')
export class AlertsController { constructor(private readonly service:AlertsService){} @Post() create(@CompanyId()c:string,@Body()d:AlertDto){return this.service.create(c,d)} @Get() list(@CompanyId()c:string){return this.service.list(c)} @Post(':id/acknowledge') acknowledge(@CompanyId()c:string,@Param('id')id:string){return this.service.acknowledge(c,id)} @Post(':id/resolve') resolve(@CompanyId()c:string,@Param('id')id:string){return this.service.resolve(c,id)} }
