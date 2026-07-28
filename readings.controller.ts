import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsString } from 'class-validator';
import { CompanyId } from '../auth/company-id.decorator';
import { ReadingsService } from './readings.service';
class ReadingDto{@IsString()upiId!:string;@IsString()variableCode!:string;@IsNumber()value!:number;@IsString()unit!:string;@IsISO8601()measuredAt!:string;}
@ApiTags('readings') @ApiBearerAuth() @Controller('readings')
export class ReadingsController{
  constructor(private readonly service:ReadingsService){}
  @Post('manual')create(@CompanyId()c:string,@Body()d:ReadingDto){return this.service.create(c,d)}
  @Get()list(@CompanyId()c:string,@Query('upiId')u?:string){return this.service.list(c,u)}
}
