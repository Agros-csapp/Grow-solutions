import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsNumber, Max, Min } from 'class-validator';
import { SimulatorService } from './simulator.service';
class ScenarioDto {
  @IsNumber() @Min(0) @Max(100) soilMoisture!: number;
  @IsNumber() @Min(0) ec!: number;
  @IsNumber() @Min(0) et0!: number;
  @IsNumber() @Min(0) drainagePercent!: number;
  @IsNumber() @Min(0) @Max(100) cloudinessPercent!: number;
  @IsNumber() @Min(0) @Max(100) rootRisk!: number;
  @IsBoolean() waterAvailable!: boolean;
  @IsNumber() @Min(0) forecastRainMm!: number;
  @IsNumber() @Min(0) @Max(100) dataConfidence!: number;
}
@ApiTags('simulator') @ApiBearerAuth() @Controller('simulator')
export class SimulatorController { constructor(private readonly service: SimulatorService) {} @Post('day') run(@Body() body: ScenarioDto) { return this.service.run(body); } }
