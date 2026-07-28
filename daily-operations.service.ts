import { Injectable } from '@nestjs/common';
import { Store } from '../common/store';

@Injectable()
export class DailyOperationsService {
  constructor(private readonly store: Store) {}

  get(companyId: string, at = new Date().toISOString()) {
    const now = new Date(at);
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    const inDay = (value: string) => { const d = new Date(value); return d >= start && d <= end; };
    const isOverdue = (value: string) => new Date(value) < now;

    const alerts = this.store.alerts
      .filter(a => a.companyId === companyId && a.status !== 'RESOLVED')
      .sort((a, b) => b.priorityScore - a.priorityScore);
    const tasks = this.store.tasks.filter(t => t.companyId === companyId && !['COMPLETED', 'VERIFIED'].includes(t.status));
    const followUps = this.store.processFollowUps.filter(f => f.companyId === companyId && ['PENDING', 'DUE'].includes(f.status));
    const recommendations = this.store.recommendations
      .filter(r => r.companyId === companyId && ['EMITTED', 'APPROVED', 'IN_EXECUTION'].includes(r.status));

    return {
      generatedAt: now.toISOString(),
      summary: {
        criticalAlerts: alerts.filter(a => a.severity === 'CRITICAL').length,
        highAlerts: alerts.filter(a => a.severity === 'HIGH').length,
        overdueTasks: tasks.filter(t => isOverdue(t.dueAt)).length,
        tasksToday: tasks.filter(t => inDay(t.dueAt)).length,
        followUpsToday: followUps.filter(f => inDay(f.dueAt)).length,
        pendingRecommendations: recommendations.length,
      },
      priorities: [
        ...alerts.slice(0, 5).map(a => ({ kind: 'ALERT', id: a.id, upiId: a.upiId, title: a.title, detail: a.description, urgency: a.priorityScore, dueAt: a.detectedAt })),
        ...tasks.filter(t => isOverdue(t.dueAt) || inDay(t.dueAt)).map(t => ({ kind: 'TASK', id: t.id, upiId: t.upiId, title: t.title, detail: t.description, urgency: t.priority === 'CRITICAL' ? 100 : t.priority === 'HIGH' ? 80 : 55, dueAt: t.dueAt })),
        ...followUps.filter(f => isOverdue(f.dueAt) || inDay(f.dueAt)).map(f => ({ kind: 'FOLLOW_UP', id: f.id, upiId: this.store.processes.find(p => p.id === f.processId)?.upiId, title: 'Seguimiento agronómico', detail: f.variables.join(', '), urgency: isOverdue(f.dueAt) ? 90 : 65, dueAt: f.dueAt })),
      ].sort((a, b) => b.urgency - a.urgency).slice(0, 10),
      recommendations: recommendations.slice(0, 5),
    };
  }
}
