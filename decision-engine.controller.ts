import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { CompanyId } from '../auth/company-id.decorator';
import { DecisionEngineService } from './decision-engine.service';
class AnalyzeDecisionDto { @IsString() upiId!: string; }
@ApiTags('decision-engine') @ApiBearerAuth() @Controller('decision-engine')
export class DecisionEngineController {
  constructor(private readonly service: DecisionEngineService) {}
  @Post('analyze') analyze(@CompanyId() companyId: string, @Body() input: AnalyzeDecisionDto) { return this.service.analyze(companyId, input.upiId); }
  @Get() list(@CompanyId() companyId: string, @Query('upiId') upiId?: string) { return this.service.list(companyId, upiId); }
  @Get(':id') get(@CompanyId() companyId: string, @Param('id') id: string) { return this.service.get(companyId, id); }
}
