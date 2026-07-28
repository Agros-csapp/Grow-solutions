import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { OrganizationModule } from './organization/organization.module';
import { UpisModule } from './upis/upis.module';
import { ObservationsModule } from './observations/observations.module';
import { ReadingsModule } from './readings/readings.module';
import { WaterModule } from './water/water.module';
import { MissionControlModule } from './mission-control/mission-control.module';
import { AuditModule } from './audit/audit.module';
import { AlertsModule } from './alerts/alerts.module';
import { ProcessesModule } from './processes/processes.module';
import { TasksModule } from './tasks/tasks.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { DecisionEngineModule } from './decision-engine/decision-engine.module';
import { ProtocolsModule } from './protocols/protocols.module';
import { EvidenceModule } from './evidence/evidence.module';
import { TimelineModule } from './timeline/timeline.module';
import { DailyOperationsModule } from './daily-operations/daily-operations.module';
import { SimulatorModule } from './simulator/simulator.module';
@Module({imports:[CommonModule,AuthModule,OrganizationModule,UpisModule,ObservationsModule,ReadingsModule,WaterModule,MissionControlModule,AuditModule,AlertsModule,ProcessesModule,TasksModule,RecommendationsModule,DecisionEngineModule,ProtocolsModule,EvidenceModule,TimelineModule,DailyOperationsModule,SimulatorModule],providers:[{provide:APP_GUARD,useClass:JwtAuthGuard}]})
export class AppModule {}
