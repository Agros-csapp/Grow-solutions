import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsISO8601, IsString } from 'class-validator';
import { CompanyId } from '../auth/company-id.decorator';
import { ObservationsService } from './observations.service';
class ObservationDto{@IsString()upiId!:string;@IsString()category!:string;@IsString()severity!:string;@IsString()description!:string;@IsISO8601()observedAt!:string;}
@ApiTags('observations') @ApiBearerAuth() @Controller('observations')
export class ObservationsController{
  constructor(private readonly service:ObservationsService){}
  @Post()create(@CompanyId()c:string,@Body()d:ObservationDto){return this.service.create(c,d)}
  @Get()list(@CompanyId()c:string,@Query('upiId')u?:string){return this.service.list(c,u)}
}
