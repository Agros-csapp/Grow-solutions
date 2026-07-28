import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { newId } from '../common/id';
import { Store } from '../common/store';
import { Recommendation } from '../common/types';
import { DecisionEngineService } from '../decision-engine/decision-engine.service';
import { ProcessesService } from '../processes/processes.service';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly store: Store,
    private readonly processes: ProcessesService,
    private readonly tasks: TasksService,
    private readonly decisionEngine: DecisionEngineService,
  ) {}

  generate(companyId: string, input: { upiId: string }) {
    const upi = this.store.upis.find((item) => item.id === input.upiId && item.companyId === companyId);
    if (!upi) throw new NotFoundException('UPI no encontrada');

    const analysis = this.decisionEngine.analyze(companyId, input.upiId);
    const selected = analysis.alternatives.find((alternative) => alternative.selected)!;
    const actionMap: Record<string, { description: string; priority: Recommendation['priority'] }> = {
      PERFORM_LEACHING: { description: 'Realizar lavado controlado de sales', priority: analysis.contextStatus.ec === 'CRITICAL' ? 'CRITICAL' : 'HIGH' },
      IRRIGATE: { description: 'Aplicar riego ajustado al déficit hídrico', priority: 'HIGH' },
      REQUEST_MEASUREMENT: { description: 'Obtener nuevas mediciones antes de intervenir', priority: 'MEDIUM' },
      WAIT_AND_MONITOR: { description: 'Esperar y monitorear la evolución del sistema', priority: 'MEDIUM' },
      NO_ACTION: { description: 'No intervenir y mantener seguimiento', priority: 'LOW' },
    };
    const action = actionMap[selected.code] ?? { description: selected.label, priority: 'MEDIUM' as const };

    const recommendation: Recommendation = {
      id: newId(),
      companyId,
      upiId: upi.id,
      actionCode: selected.code,
      actionDescription: action.description,
      priority: action.priority,
      confidence: analysis.confidence,
      rationale: analysis.rationale,
      alternatives: analysis.alternatives.filter((item) => !item.selected).map((item) => `${item.code}:${item.score}`),
      status: 'EMITTED',
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 24 * 3600_000).toISOString(),
    };
    this.store.addRecommendation(recommendation);
    return { ...recommendation, decisionAnalysisId: analysis.id, followUp: analysis.followUp, contradictions: analysis.contradictions };
  }

  list(companyId: string) {
    return this.store.recommendations.filter((recommendation) => recommendation.companyId === companyId);
  }

  explain(companyId: string, id: string) {
    const recommendation = this.find(companyId, id);
    const analysis = [...this.store.decisionAnalyses]
      .filter((item) => item.companyId === companyId && item.upiId === recommendation.upiId && item.selectedAction === recommendation.actionCode)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    return {
      summary: recommendation.actionDescription,
      detectedCondition: analysis?.contextStatus ?? null,
      evidence: analysis?.factors ?? recommendation.rationale,
      keyVariables: analysis?.factors.map((factor) => ({ code: factor.code, contribution: factor.weight, interpretation: factor.interpretation })) ?? [],
      causalPath: analysis?.rationale ?? recommendation.rationale,
      evaluatedAlternatives: analysis?.alternatives ?? recommendation.alternatives,
      contradictions: analysis?.contradictions ?? [],
      confidence: recommendation.confidence,
      confidenceExplanation: {
        modelVersion: analysis?.modelVersion ?? 'LEGACY',
        missingVariables: analysis?.missingVariables ?? [],
      },
      riskOfNotActing: recommendation.priority === 'CRITICAL' ? 'Alto' : recommendation.priority === 'HIGH' ? 'Medio-alto' : 'Moderado',
      followUp: analysis?.followUp ?? { verifyInHours: 24, variables: ['EC', 'SOIL_MOISTURE'] },
    };
  }

  approve(companyId: string, id: string, input: { assignedTo: string }) {
    const recommendation = this.find(companyId, id);
    if (new Date(recommendation.validUntil).getTime() < Date.now()) throw new UnprocessableEntityException('La recomendación está vencida');
    recommendation.status = 'APPROVED';
    this.store.updateRecommendation(recommendation);
    const process = this.processes.create(companyId, {
      upiId: recommendation.upiId,
      recommendationId: recommendation.id,
      type: recommendation.actionCode,
      title: recommendation.actionDescription,
      objective: 'Ejecutar la recomendación y verificar su resultado agronómico',
      priority: recommendation.priority,
    });
    const task = this.tasks.create(companyId, {
      upiId: recommendation.upiId,
      processId: process.id,
      title: recommendation.actionDescription,
      description: recommendation.rationale.join('. '),
      assignedTo: input.assignedTo,
      priority: recommendation.priority,
      dueAt: recommendation.validUntil,
      evidenceRequired: true,
    });
    return { recommendation, process, task };
  }

  reject(companyId: string, id: string) {
    const recommendation = this.find(companyId, id);
    recommendation.status = 'REJECTED';
    this.store.updateRecommendation(recommendation);
    return recommendation;
  }

  private find(companyId: string, id: string) {
    const recommendation = this.store.recommendations.find((item) => item.id === id && item.companyId === companyId);
    if (!recommendation) throw new NotFoundException('Recomendación no encontrada');
    return recommendation;
  }
}
