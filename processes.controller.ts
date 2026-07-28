import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CompanyId } from '../auth/company-id.decorator';
import { AgronomicProcess } from '../common/types';
import { ProcessesService } from './processes.service';
class ProcessDto{@IsString()upiId!:string;@IsOptional()@IsString()recommendationId?:string;@IsString()type!:string;@IsString()title!:string;@IsString()objective!:string;@IsIn(['LOW','MEDIUM','HIGH','CRITICAL'])priority!:AgronomicProcess['priority'];}
class MetricDto{@IsString()code!:string;@IsNumber()expected!:number;@IsNumber()observed!:number;@IsNumber()@Min(0)tolerance!:number;@IsIn(['MIN','MAX','TARGET'])objective!:'MIN'|'MAX'|'TARGET';}
class OutcomeDto{@IsArray()@ValidateNested({each:true})@Type(()=>MetricDto)metrics!:MetricDto[];@IsNumber()@Min(0)@Max(100)confidence!:number;@IsString()evaluatedBy!:string;}
@ApiTags('processes') @ApiBearerAuth() @Controller('agronomic-processes')
export class ProcessesController{
  constructor(private readonly service:ProcessesService){}
  @Post()create(@CompanyId()c:string,@Body()d:ProcessDto){return this.service.create(c,d)}
  @Get()list(@CompanyId()c:string){return this.service.list(c)}
  @Get(':id')get(@CompanyId()c:string,@Param('id')id:string){return this.service.get(c,id)}
  @Post(':id/outcomes/evaluate')evaluate(@CompanyId()c:string,@Param('id')id:string,@Body()d:OutcomeDto){return this.service.evaluate(c,id,d)}
  @Post(':id/follow-ups/:followUpId/complete')completeFollowUp(@CompanyId()c:string,@Param('id')id:string,@Param('followUpId')followUpId:string){return this.service.completeFollowUp(c,id,followUpId)}
  @Post(':id/close')close(@CompanyId()c:string,@Param('id')id:string){return this.service.close(c,id)}
}
