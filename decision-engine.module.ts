import { Module } from '@nestjs/common';
import { DecisionEngineController } from './decision-engine.controller';
import { DecisionEngineService } from './decision-engine.service';
@Module({ controllers: [DecisionEngineController], providers: [DecisionEngineService], exports: [DecisionEngineService] })
export class DecisionEngineModule {}
