import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompanyId } from '../auth/company-id.decorator';
import { TimelineService } from './timeline.service';
@ApiTags('timeline') @ApiBearerAuth() @Controller('upis/:upiId/timeline')
export class TimelineController {
  constructor(private readonly service: TimelineService) {}
  @Get() get(@CompanyId() companyId: string, @Param('upiId') upiId: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('type') type?: string) {
    return this.service.get(companyId, upiId, { page: Number(page ?? 1), pageSize: Number(pageSize ?? 30), type });
  }
}
