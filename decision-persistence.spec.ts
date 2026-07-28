import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Store } from './common/store';

const analysis = {
  id: 'd1', companyId: 'c1', upiId: 'u1', modelCode: 'ADE_WATER_DECISION', modelVersion: 'ADE-WATER-0.1.0',
  createdAt: new Date().toISOString(), confidence: 88,
  contextStatus: { moisture: 'OPTIMAL', ec: 'HIGH', drainage: 'ADEQUATE', rootRisk: 'LOW' },
  factors: [], missingVariables: [], contradictions: [], alternatives: [], selectedAction: 'PERFORM_LEACHING',
  rationale: ['test'], followUp: { verifyInHours: 24, variables: ['EC'], anticipateNextDayIrrigation: 'LIKELY_NOT_REQUIRED' },
};

describe('decision analysis persistence', () => {
  it('survives a store restart', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agros-decision-'));
    const dbPath = join(dir, 'agros.db');
    process.env.AGROS_DB_PATH = dbPath;
    const first = new Store();
    first.addCompany({ id: 'c1', legalName: 'Test', taxIdentifier: 'T-1', countryCode: 'CO' });
    first.addFarm({ id: 'f1', companyId: 'c1', code: 'F1', name: 'Farm', totalAreaHa: 1 });
    first.addBlock({ id: 'b1', companyId: 'c1', farmId: 'f1', code: 'B1', name: 'Block', areaHa: 1 });
    first.addUpi({ id: 'u1', companyId: 'c1', blockId: 'b1', code: 'U1', name: 'UPI', areaM2: 100, crop: 'Rose', variety: 'Freedom', status: 'ACTIVE' });
    first.addDecisionAnalysis(analysis);
    first.close();
    const second = new Store();
    expect(second.decisionAnalyses).toHaveLength(1);
    expect(second.decisionAnalyses[0]?.selectedAction).toBe('PERFORM_LEACHING');
    second.close();
    delete process.env.AGROS_DB_PATH;
    rmSync(dir, { recursive: true, force: true });
  });
});
