import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { CompanyId } from '../auth/company-id.decorator';
import { UpisService } from './upis.service';
class UpiDto { @IsString() blockId!:string; @IsString() code!:string; @IsString() name!:string; @IsNumber() @IsPositive() areaM2!:number; @IsString() crop!:string; @IsString() variety!:string; @IsOptional() @IsNumber() fieldCapacity?:number; @IsOptional() @IsNumber() wiltingPoint?:number; }
@ApiTags('upis') @ApiBearerAuth() @Controller('upis')
export class UpisController {
  constructor(private readonly service:UpisService){}
  @Post() create(@CompanyId() c:string,@Body()dto:UpiDto){return this.service.create(c,dto)}
  @Get() list(@CompanyId() c:string){return this.service.list(c)}
  @Get(':id') get(@CompanyId() c:string,@Param('id')id:string){return this.service.get(c,id)}
}
