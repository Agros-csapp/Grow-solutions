import { Injectable } from '@nestjs/common';
import { Store } from '../common/store';

@Injectable()
export class MissionControlService {
  constructor(private readonly store: Store) {}

  private health(companyId: string, upiId: string) {
    const readings = this.store.readings.filter(r => r.companyId === companyId && r.upiId === upiId);
    const alerts = this.store.alerts.filter(a => a.companyId === companyId && a.upiId === upiId && a.status !== 'RESOLVED');
    const tasks = this.store.tasks.filter(t => t.companyId === companyId && t.upiId === upiId && !['COMPLETED', 'VERIFIED'].includes(t.status));
    const latest = (code: string) => readings.filter(r => r.variableCode === code).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
    const moisture = latest('SOIL_MOISTURE'); const ec = latest('EC');
    const water = moisture ? Math.max(0, 100 - Math.abs(30 - moisture.value) * 3) : 45;
    const salinity = ec ? Math.max(0, 100 - Math.max(0, ec.value - 1.5) * 25) : 50;
    const data = readings.length ? Math.round(readings.reduce((s, r) => s + r.confidence, 0) / readings.length) : 35;
    const operation = Math.max(0, 100 - tasks.length * 8);
    const riskPenalty = alerts.reduce((s, a) => s + (a.severity === 'CRITICAL' ? 25 : a.severity === 'HIGH' ? 14 : 5), 0);
    const score = Math.max(0, Math.min(100, Math.round(water * .3 + salinity * .25 + data * .25 + operation * .2 - riskPenalty)));
    return { score, components: { water: Math.round(water), salinity: Math.round(salinity), data, operation }, confidence: data };
  }

  get(companyId: string) {
    const upis = this.store.upis.filter(u => u.companyId === companyId);
    const observations = this.store.observations.filter(o => o.companyId === companyId);
    const readings = this.store.readings.filter(r => r.companyId === companyId);
    const alerts = this.store.alerts.filter(a => a.companyId === companyId && a.status !== 'RESOLVED').sort((a, b) => b.priorityScore - a.priorityScore);
    const recommendations = this.store.recommendations.filter(r => r.companyId === companyId && ['EMITTED', 'APPROVED', 'IN_EXECUTION'].includes(r.status));
    const processes = this.store.processes.filter(p => p.companyId === companyId && !['COMPLETED', 'CANCELLED'].includes(p.status));
    const tasks = this.store.tasks.filter(t => t.companyId === companyId && !['COMPLETED', 'VERIFIED'].includes(t.status));
    const critical = alerts.filter(a => a.severity === 'CRITICAL').length; const high = alerts.filter(a => a.severity === 'HIGH').length;
    const dataConfidence = readings.length ? Math.round(readings.reduce((s, r) => s + r.confidence, 0) / readings.length) : 0;
    const decisions = this.store.decisionAnalyses.filter(d => d.companyId === companyId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const upiMap = upis.map(u => ({ id: u.id, code: u.code, name: u.name, status: u.status, crop: u.crop, alerts: alerts.filter(a => a.upiId === u.id).length, health: this.health(companyId, u.id) }));
    const averageHealth = upiMap.length ? Math.round(upiMap.reduce((s, u) => s + u.health.score, 0) / upiMap.length) : 0;
    return {
      build: '0.5.0-alpha.7', generalStatus: { ima: averageHealth || Math.max(0, 100 - critical * 18 - high * 8), trend: critical ? 'AT_RISK' : 'STABLE', confidence: dataConfidence },
      counts: { upis: upis.length, observations: observations.length, readings: readings.length, irrigations: this.store.irrigations.filter(i => i.companyId === companyId).length, alerts: alerts.length, recommendations: recommendations.length, processes: processes.length, tasks: tasks.length, protocolExecutions: this.store.protocolExecutions.filter(e => e.companyId === companyId && e.status !== 'COMPLETED').length, followUps: this.store.processFollowUps.filter(f => f.companyId === companyId && f.status === 'PENDING').length, evidence: this.store.evidence.filter(e => e.companyId === companyId).length },
      upiMap, topPriorities: alerts.slice(0, 5), recommendations: recommendations.slice(0, 5), openProcesses: processes.slice(0, 5), pendingTasks: tasks.slice(0, 5), latestDecisions: decisions.slice(0, 5)
    };
  }
}
