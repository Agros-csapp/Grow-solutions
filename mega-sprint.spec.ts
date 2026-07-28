import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { Store } from './common/store';
import { DailyOperationsService } from './daily-operations/daily-operations.service';
import { MissionControlService } from './mission-control/mission-control.service';
import { SimulatorService } from './simulator/simulator.service';
import { TimelineService } from './timeline/timeline.service';

describe('Mega Sprint 01', () => {
  let store: Store; let day: DailyOperationsService; let mission: MissionControlService; let simulator: SimulatorService; let timeline: TimelineService;
  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    store = module.get(Store); day = module.get(DailyOperationsService); mission = module.get(MissionControlService); simulator = module.get(SimulatorService); timeline = module.get(TimelineService);
    store.addCompany({ id: 'c', legalName: 'Company', taxIdentifier: 'T1', countryCode: 'CO' });
    store.addUser({ id: 'u', companyId: 'c', email: 'u@c.co', roles: ['SUPERVISOR'], passwordHash: 'x' });
    store.addFarm({ id: 'f', companyId: 'c', code: 'F', name: 'Farm', totalAreaHa: 1 });
    store.addBlock({ id: 'b', companyId: 'c', farmId: 'f', code: 'B', name: 'Block', areaHa: 1 });
    store.addUpi({ id: 'p', companyId: 'c', blockId: 'b', code: 'P', name: 'UPI', areaM2: 1000, crop: 'Rose', variety: 'Freedom', status: 'ACTIVE' });
  });
  afterEach(() => store.close());

  it('builds a supervisor daily agenda ordered by urgency', () => {
    const now = new Date();
    store.addAlert({ id:'a', companyId:'c', upiId:'p', type:'EC_HIGH', severity:'HIGH', priorityScore:85, title:'CE alta', description:'Revisar lavado', sourceType:'READING', sourceId:'r', status:'OPEN', detectedAt:now.toISOString() });
    store.addTask({ id:'t', companyId:'c', upiId:'p', title:'Medir drenaje', description:'Confirmar drenaje', assignedTo:'u', priority:'HIGH', dueAt:now.toISOString(), status:'PENDING', evidenceRequired:false, evidenceCount:0 });
    const result = day.get('c', now.toISOString());
    expect(result.summary.highAlerts).toBe(1);
    expect(result.priorities[0].urgency).toBeGreaterThanOrEqual(result.priorities[1].urgency);
  });

  it('calculates explainable UPI health components', () => {
    store.addReading({ id:'m', companyId:'c', upiId:'p', variableCode:'SOIL_MOISTURE', value:30, unit:'PERCENT', measuredAt:new Date().toISOString(), confidence:92 });
    store.addReading({ id:'e', companyId:'c', upiId:'p', variableCode:'EC', value:1.4, unit:'dS/m', measuredAt:new Date().toISOString(), confidence:90 });
    const upi = mission.get('c').upiMap[0];
    expect(upi.health.score).toBeGreaterThan(70);
    expect(upi.health.components.data).toBe(91);
  });

  it('paginates and filters timeline safely', () => {
    for (let i=0;i<5;i++) store.addReading({ id:`r${i}`, companyId:'c', upiId:'p', variableCode:'EC', value:1+i/10, unit:'dS/m', measuredAt:new Date(Date.now()+i*1000).toISOString(), confidence:90 });
    store.addObservation({ id:'o', companyId:'c', upiId:'p', category:'ROOT', severity:'HIGH', description:'Check', observedAt:new Date().toISOString() });
    const result = timeline.get('c','p',{page:1,pageSize:2,type:'READING'});
    expect(result.items).toHaveLength(2);
    expect(result.pagination.totalItems).toBe(5);
    expect(result.items.every(x=>x.type==='READING')).toBe(true);
  });

  it('simulates leaching with next-day irrigation anticipation', () => {
    const result = simulator.run({ soilMoisture:30, ec:3.2, et0:5.8, drainagePercent:25, cloudinessPercent:88, rootRisk:20, waterAvailable:true, forecastRainMm:0, dataConfidence:94 });
    expect(result.selectedAction).toBe('PERFORM_LEACHING');
    expect(result.nextDayIrrigation).toBe('LIKELY_NOT_REQUIRED_REEVALUATE');
    expect(result.persisted).toBe(false);
  });

  it('blocks unsafe leaching scenarios', () => {
    const result = simulator.run({ soilMoisture:95, ec:3.5, et0:5, drainagePercent:5, cloudinessPercent:30, rootRisk:80, waterAvailable:true, forecastRainMm:0, dataConfidence:95 });
    expect(result.selectedAction).toBe('VERIFY_OR_WAIT');
    expect(result.blockers).toEqual(expect.arrayContaining(['SATURATION_RISK','POOR_DRAINAGE','HIGH_ROOT_RISK']));
  });
});
