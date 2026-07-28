import { Test } from '@nestjs/testing';
import { CommonModule } from './common/common.module';
import { Store } from './common/store';
import { DecisionEngineService } from './decision-engine/decision-engine.service';

function seed(store: Store) {
  const companyId = 'c1';
  store.addCompany({ id: companyId, legalName: 'Test', taxIdentifier: `tax-${Math.random()}`, countryCode: 'CO' });
  store.addUser({ id: 'u1', companyId, email: 'a@a.com', roles: ['ADMIN'], passwordHash: 'x' });
  store.addFarm({ id: 'f1', companyId, code: 'F1', name: 'Farm', totalAreaHa: 1 });
  store.addBlock({ id: 'b1', companyId, farmId: 'f1', code: 'B1', name: 'Block', areaHa: 1 });
  store.addUpi({ id: 'upi1', companyId, blockId: 'b1', code: 'U1', name: 'UPI', areaM2: 1000, crop: 'Rose', variety: 'Freedom', fieldCapacity: 36, wiltingPoint: 16, status: 'ACTIVE' });
  return companyId;
}

function reading(store: Store, code: string, value: number, unit = 'PERCENT', confidence = 90) {
  store.addReading({ id: `${code}-${Math.random()}`, companyId: 'c1', upiId: 'upi1', variableCode: code, value, unit, measuredAt: new Date().toISOString(), confidence });
}

describe('Agronomic Decision Engine', () => {
  let store: Store;
  let engine: DecisionEngineService;
  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    const module = await Test.createTestingModule({ imports: [CommonModule], providers: [DecisionEngineService] }).compile();
    store = module.get(Store);
    engine = module.get(DecisionEngineService);
    seed(store);
  });
  afterEach(() => store.close());

  it('prioritizes controlled leaching in the integrated salinity scenario', () => {
    reading(store, 'SOIL_MOISTURE', 30);
    reading(store, 'EC', 3.2, 'DS_M');
    reading(store, 'ET0', 5.8, 'MM_DAY');
    reading(store, 'DRAINAGE_PERCENT', 25);
    reading(store, 'CLOUD_COVER', 88);
    reading(store, 'ROOT_RISK', 20);
    reading(store, 'WATER_AVAILABILITY', 1, 'BOOLEAN');
    reading(store, 'RAINFALL_FORECAST', 0, 'MM');
    const result = engine.analyze('c1', 'upi1');
    expect(result.selectedAction).toBe('PERFORM_LEACHING');
    expect(result.followUp.anticipateNextDayIrrigation).toBe('LIKELY_NOT_REQUIRED');
    expect(result.alternatives[0].score).toBeGreaterThanOrEqual(90);
  });

  it('blocks leaching when root risk is high', () => {
    reading(store, 'SOIL_MOISTURE', 30);
    reading(store, 'EC', 3.2, 'DS_M');
    reading(store, 'DRAINAGE_PERCENT', 25);
    reading(store, 'ROOT_RISK', 85);
    reading(store, 'WATER_AVAILABILITY', 1, 'BOOLEAN');
    const result = engine.analyze('c1', 'upi1');
    expect(result.selectedAction).not.toBe('PERFORM_LEACHING');
    expect(result.contradictions.some((item) => item.includes('riesgo radicular alto'))).toBe(true);
  });

  it('requests measurements when confidence is insufficient', () => {
    reading(store, 'EC', 3.2, 'DS_M', 35);
    const result = engine.analyze('c1', 'upi1');
    expect(result.selectedAction).toBe('REQUEST_MEASUREMENT');
    expect(result.missingVariables.length).toBeGreaterThan(0);
  });
});
