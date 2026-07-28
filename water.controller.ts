import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsPositive, IsString } from 'class-validator';
import { CompanyId } from '../auth/company-id.decorator';
import { WaterService } from './water.service';
class IrrigationDto{@IsString()upiId!:string;@IsISO8601()startAt!:string;@IsISO8601()endAt!:string;@IsNumber()@IsPositive()flowRateM3h!:number;}
@ApiTags('water') @ApiBearerAuth() @Controller('water')
export class WaterController{
  constructor(private readonly service:WaterService){}
  @Post('irrigations')create(@CompanyId()c:string,@Body()d:IrrigationDto){return this.service.register(c,d)}
  @Get('irrigations')list(@CompanyId()c:string){return this.service.list(c)}
}
