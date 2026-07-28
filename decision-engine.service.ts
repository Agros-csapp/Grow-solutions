import { Injectable, NotFoundException } from '@nestjs/common';
import { Store } from '../common/store';
import { DecisionAnalysis, DecisionAlternative, DecisionFactor, Reading } from '../common/types';
import { newId } from '../common/id';

const MODEL_VERSION = 'ADE-WATER-0.1.0';
type LatestMap = Record<string, Reading | undefined>;

@Injectable()
export class DecisionEngineService {
  constructor(private readonly store: Store) {}

  analyze(companyId: string, upiId: string): DecisionAnalysis {
    const upi = this.store.upis.find((item) => item.id === upiId && item.companyId === companyId);
    if (!upi) throw new NotFoundException('UPI no encontrada');

    const latest = this.latestByVariable(companyId, upiId, [
      'SOIL_MOISTURE', 'EC', 'ET0', 'DRAINAGE_PERCENT', 'CLOUD_COVER',
      'ROOT_RISK', 'WATER_AVAILABILITY', 'RAINFALL_FORECAST',
    ]);

    const factors: DecisionFactor[] = [];
    const missing: string[] = [];
    const add = (code: string, label: string, reading: Reading | undefined, interpretation: string, weight: number) => {
      if (!reading) { missing.push(code); return; }
      factors.push({ code, label, value: reading.value, unit: reading.unit, confidence: reading.confidence, interpretation, weight, readingId: reading.id });
    };

    const moisture = latest.SOIL_MOISTURE;
    const ec = latest.EC;
    const et0 = latest.ET0;
    const drainage = latest.DRAINAGE_PERCENT;
    const cloud = latest.CLOUD_COVER;
    const rootRisk = latest.ROOT_RISK;
    const waterAvailability = latest.WATER_AVAILABILITY;
    const rain = latest.RAINFALL_FORECAST;

    const moistureStatus = this.moistureStatus(moisture?.value, upi.wiltingPoint, upi.fieldCapacity);
    const ecStatus = ec ? (ec.value >= 3.5 ? 'CRITICAL' : ec.value >= 2.5 ? 'HIGH' : ec.value >= 1.8 ? 'WATCH' : 'NORMAL') : 'UNKNOWN';
    const drainageStatus = drainage ? (drainage.value >= 15 && drainage.value <= 45 ? 'ADEQUATE' : drainage.value < 15 ? 'LOW' : 'HIGH') : 'UNKNOWN';
    const rootStatus = rootRisk ? (rootRisk.value >= 70 ? 'HIGH' : rootRisk.value >= 40 ? 'MEDIUM' : 'LOW') : 'UNKNOWN';
    const waterAvailable = !waterAvailability || waterAvailability.value >= 1;
    const rainRisk = rain ? rain.value >= 10 : false;

    add('SOIL_MOISTURE', 'Humedad del suelo', moisture, moistureStatus, 0.22);
    add('EC', 'Conductividad eléctrica', ec, ecStatus, 0.25);
    add('ET0', 'ET₀', et0, et0 && et0.value >= 5 ? 'HIGH' : 'NORMAL', 0.10);
    add('DRAINAGE_PERCENT', 'Drenaje', drainage, drainageStatus, 0.16);
    add('CLOUD_COVER', 'Nubosidad', cloud, cloud && cloud.value >= 80 ? 'VERY_HIGH' : 'NORMAL', 0.05);
    add('ROOT_RISK', 'Riesgo radicular', rootRisk, rootStatus, 0.17);
    add('WATER_AVAILABILITY', 'Disponibilidad de agua', waterAvailability, waterAvailable ? 'AVAILABLE' : 'NOT_AVAILABLE', 0.05);

    const weightedTotal = factors.reduce((sum, factor) => sum + factor.weight, 0);
    const avgConfidence = weightedTotal > 0
      ? Math.round(factors.reduce((sum, factor) => sum + factor.confidence * factor.weight, 0) / weightedTotal)
      : 0;

    const alternatives: DecisionAlternative[] = [
      { code: 'NO_ACTION', label: 'No intervenir', score: 20, benefits: ['Sin consumo adicional'], risks: ['Puede aumentar el estrés osmótico'], selected: false },
      { code: 'REQUEST_MEASUREMENT', label: 'Solicitar nueva medición', score: missing.length ? 82 : 35, benefits: ['Reduce incertidumbre'], risks: ['Retrasa la intervención'], selected: false },
      { code: 'IRRIGATE', label: 'Aplicar riego convencional', score: 30, benefits: ['Corrige déficit hídrico'], risks: ['Puede elevar humedad sin corregir sales'], selected: false },
      { code: 'PERFORM_LEACHING', label: 'Realizar lavado controlado', score: 25, benefits: ['Reduce concentración de sales'], risks: ['Incrementa humedad temporalmente', 'Puede aumentar riesgo de hipoxia'], selected: false },
      { code: 'WAIT_AND_MONITOR', label: 'Esperar y monitorear', score: 40, benefits: ['Evita intervención innecesaria'], risks: ['Puede perderse la ventana técnica'], selected: false },
    ];
    const find = (code: string) => alternatives.find((item) => item.code === code)!;

    if (moistureStatus === 'LOW' && ecStatus !== 'HIGH' && ecStatus !== 'CRITICAL') find('IRRIGATE').score = 88;

    const leachingSafe =
      (moistureStatus === 'SUFFICIENT' || moistureStatus === 'OPTIMAL') &&
      (ecStatus === 'HIGH' || ecStatus === 'CRITICAL') &&
      drainageStatus === 'ADEQUATE' && rootStatus !== 'HIGH' && waterAvailable && !rainRisk;

    if (leachingSafe) {
      let score = 86;
      if (et0 && et0.value >= 5) score += 4;
      if (cloud && cloud.value >= 80) score += 2;
      if (rootStatus === 'LOW') score += 3;
      find('PERFORM_LEACHING').score = Math.min(98, score);
      find('IRRIGATE').score = 42;
      find('WAIT_AND_MONITOR').score = 34;
    }

    if (moistureStatus === 'SATURATED' || drainageStatus === 'LOW' || rootStatus === 'HIGH' || !waterAvailable || rainRisk) {
      find('PERFORM_LEACHING').score = 5;
      find('WAIT_AND_MONITOR').score = 78;
      if (missing.length) find('REQUEST_MEASUREMENT').score = 90;
    }

    if (avgConfidence < 60) {
      find('REQUEST_MEASUREMENT').score = 96;
      find('PERFORM_LEACHING').score = Math.min(find('PERFORM_LEACHING').score, 35);
      find('IRRIGATE').score = Math.min(find('IRRIGATE').score, 35);
    }

    alternatives.sort((a, b) => b.score - a.score);
    alternatives[0].selected = true;
    const selected = alternatives[0];

    const contradictions = this.contradictions({ moistureStatus, ecStatus, et0, cloud, rootStatus, drainageStatus });
    const followUp = selected.code === 'PERFORM_LEACHING'
      ? { verifyInHours: 24, variables: ['EC', 'SOIL_MOISTURE', 'DRAINAGE_PERCENT', 'ROOT_RISK'], anticipateNextDayIrrigation: 'LIKELY_NOT_REQUIRED', note: 'El lavado aumenta temporalmente la humedad. Reevaluar antes de programar riego al día siguiente.' }
      : selected.code === 'IRRIGATE'
        ? { verifyInHours: 6, variables: ['SOIL_MOISTURE', 'DRAINAGE_PERCENT'], anticipateNextDayIrrigation: 'REASSESS' }
        : { verifyInHours: 6, variables: missing.length ? missing : ['SOIL_MOISTURE', 'EC'], anticipateNextDayIrrigation: 'REASSESS' };

    const analysis: DecisionAnalysis = {
      id: newId(), companyId, upiId, modelCode: 'ADE_WATER_DECISION', modelVersion: MODEL_VERSION,
      createdAt: new Date().toISOString(), confidence: Math.max(20, Math.min(99, avgConfidence - missing.length * 7 - contradictions.length * 2)),
      contextStatus: { moisture: moistureStatus, ec: ecStatus, drainage: drainageStatus, rootRisk: rootStatus },
      factors, missingVariables: missing, contradictions, alternatives, selectedAction: selected.code,
      rationale: this.rationale({ moistureStatus, ecStatus, drainageStatus, rootStatus, et0, cloud, missing, rainRisk, waterAvailable, selected: selected.code }),
      followUp,
    };
    this.store.addDecisionAnalysis(analysis);
    return analysis;
  }

  list(companyId: string, upiId?: string): DecisionAnalysis[] {
    return this.store.decisionAnalyses.filter((item) => item.companyId === companyId && (!upiId || item.upiId === upiId));
  }

  get(companyId: string, id: string): DecisionAnalysis {
    const analysis = this.store.decisionAnalyses.find((item) => item.id === id && item.companyId === companyId);
    if (!analysis) throw new NotFoundException('Análisis de decisión no encontrado');
    return analysis;
  }

  private latestByVariable(companyId: string, upiId: string, codes: string[]): LatestMap {
    const result: LatestMap = {};
    for (const code of codes) {
      result[code] = [...this.store.readings]
        .filter((reading) => reading.companyId === companyId && reading.upiId === upiId && reading.variableCode === code)
        .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
    }
    return result;
  }

  private moistureStatus(value?: number, wiltingPoint?: number, fieldCapacity?: number): string {
    if (value === undefined) return 'UNKNOWN';
    if (wiltingPoint !== undefined && value <= wiltingPoint) return 'LOW';
    if (fieldCapacity !== undefined) {
      if (value > fieldCapacity * 1.08) return 'SATURATED';
      if (value >= fieldCapacity * 0.72) return 'OPTIMAL';
      return 'SUFFICIENT';
    }
    if (value < 20) return 'LOW';
    if (value > 45) return 'SATURATED';
    if (value >= 28) return 'OPTIMAL';
    return 'SUFFICIENT';
  }

  private rationale(input: { moistureStatus: string; ecStatus: string; drainageStatus: string; rootStatus: string; et0?: Reading; cloud?: Reading; missing: string[]; rainRisk: boolean; waterAvailable: boolean; selected: string }): string[] {
    const items = [`Estado hídrico: ${input.moistureStatus}.`, `Conductividad eléctrica: ${input.ecStatus}.`, `Drenaje: ${input.drainageStatus}.`, `Riesgo radicular: ${input.rootStatus}.`];
    if (input.et0) items.push(`ET₀ observada: ${input.et0.value} ${input.et0.unit}.`);
    if (input.cloud) items.push(`Nubosidad observada: ${input.cloud.value} ${input.cloud.unit}.`);
    if (!input.waterAvailable) items.push('No existe disponibilidad de agua confirmada.');
    if (input.rainRisk) items.push('Existe lluvia prevista que aumenta el riesgo operativo.');
    if (input.missing.length) items.push(`Faltan variables: ${input.missing.join(', ')}.`);
    items.push(`La alternativa con mayor beneficio integral fue ${input.selected}.`);
    return items;
  }

  private contradictions(input: { moistureStatus: string; ecStatus: string; et0?: Reading; cloud?: Reading; rootStatus: string; drainageStatus: string }): string[] {
    const result: string[] = [];
    if (input.et0 && input.et0.value >= 5 && (input.moistureStatus === 'OPTIMAL' || input.moistureStatus === 'SATURATED')) result.push('La ET₀ alta favorece aumentar aporte hídrico, pero la humedad actual indica que no debe aplicarse riego convencional sin evaluar sales y raíz.');
    if ((input.ecStatus === 'HIGH' || input.ecStatus === 'CRITICAL') && input.rootStatus === 'HIGH') result.push('La CE favorece un lavado, pero el riesgo radicular alto obliga a posponerlo o ejecutarlo bajo un protocolo de recuperación.');
    if (input.cloud && input.cloud.value >= 80 && input.et0 && input.et0.value >= 5) result.push('La nubosidad muy alta y la ET₀ alta parecen contradictorias; se conserva la evidencia y se reduce confianza si la fuente no está validada.');
    if (input.drainageStatus === 'LOW' && (input.ecStatus === 'HIGH' || input.ecStatus === 'CRITICAL')) result.push('La necesidad de remover sales entra en conflicto con una capacidad de drenaje insuficiente.');
    return result;
  }
}
