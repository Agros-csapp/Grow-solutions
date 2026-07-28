import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompanyId } from '../auth/company-id.decorator';
import { MissionControlService } from './mission-control.service';
@ApiTags('mission-control') @ApiBearerAuth() @Controller('mission-control')
export class MissionControlController{
  constructor(private readonly service:MissionControlService){}
  @Get()get(@CompanyId()c:string){return this.service.get(c)}
}
