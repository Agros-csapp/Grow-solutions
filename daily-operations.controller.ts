import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompanyId } from '../auth/company-id.decorator';
import { DailyOperationsService } from './daily-operations.service';

@ApiTags('daily-operations')
@ApiBearerAuth()
@Controller('my-day')
export class DailyOperationsController {
  constructor(private readonly service: DailyOperationsService) {}
  @Get() get(@CompanyId() companyId: string, @Query('at') at?: string) { return this.service.get(companyId, at); }
}
