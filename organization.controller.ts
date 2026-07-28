import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString } from 'class-validator';
import { CompanyId } from '../auth/company-id.decorator';
import { OrganizationService } from './organization.service';
class FarmDto { @IsString() code!:string; @IsString() name!:string; @IsNumber() @IsPositive() totalAreaHa!:number; }
class BlockDto { @IsString() farmId!:string; @IsString() code!:string; @IsString() name!:string; @IsNumber() @IsPositive() areaHa!:number; }
@ApiTags('organization') @ApiBearerAuth() @Controller()
export class OrganizationController {
  constructor(private readonly service:OrganizationService){}
  @Post('farms') createFarm(@CompanyId() c:string,@Body() dto:FarmDto){return this.service.createFarm(c,dto)}
  @Get('farms') farms(@CompanyId() c:string){return this.service.listFarms(c)}
  @Post('blocks') createBlock(@CompanyId() c:string,@Body()dto:BlockDto){return this.service.createBlock(c,dto)}
  @Get('blocks') blocks(@CompanyId() c:string){return this.service.listBlocks(c)}
}
