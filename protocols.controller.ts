import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { CompanyId } from '../auth/company-id.decorator';
import { ProtocolsService } from './protocols.service';
class StartDto { @IsOptional() @IsString() protocolCode?:string; }
class ExecuteDto { @IsString() executedBy!:string; @IsInt() @Min(0) evidenceCount!:number; @IsObject() enteredValues!:Record<string,number|string|boolean>; }
class SkipDto { @IsString() executedBy!:string; @IsString() reason!:string; }
@ApiTags('protocols') @ApiBearerAuth() @Controller('protocols')
export class ProtocolsController {
  constructor(private readonly service:ProtocolsService){}
  @Get() list(@CompanyId() companyId:string){return this.service.list(companyId)}
  @Post('processes/:processId/start') start(@CompanyId() companyId:string,@Param('processId')processId:string,@Body()dto:StartDto){return this.service.start(companyId,processId,dto.protocolCode)}
  @Get('processes/:processId/execution') execution(@CompanyId() companyId:string,@Param('processId')processId:string){return this.service.getExecution(companyId,processId)}
  @Post('processes/:processId/steps/:stepId/execute') execute(@CompanyId() companyId:string,@Param('processId')processId:string,@Param('stepId')stepId:string,@Body()dto:ExecuteDto){return this.service.executeStep(companyId,processId,stepId,dto)}
  @Post('processes/:processId/steps/:stepId/skip') skip(@CompanyId() companyId:string,@Param('processId')processId:string,@Param('stepId')stepId:string,@Body()dto:SkipDto){return this.service.skipStep(companyId,processId,stepId,dto)}
  @Post('processes/:processId/suspend') suspend(@CompanyId() companyId:string,@Param('processId')processId:string){return this.service.suspend(companyId,processId)}
  @Post('processes/:processId/resume') resume(@CompanyId() companyId:string,@Param('processId')processId:string){return this.service.resume(companyId,processId)}
}
