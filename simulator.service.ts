import { Injectable, UnprocessableEntityException } from '@nestjs/common';

export interface DayScenario {
  soilMoisture: number;
  ec: number;
  et0: number;
  drainagePercent: number;
  cloudinessPercent: number;
  rootRisk: number;
  waterAvailable: boolean;
  forecastRainMm: number;
  dataConfidence: number;
}

@Injectable()
export class SimulatorService {
  run(input: DayScenario) {
    const values = [input.soilMoisture, input.ec, input.et0, input.drainagePercent, input.cloudinessPercent, input.rootRisk, input.forecastRainMm, input.dataConfidence];
    if (values.some(v => !Number.isFinite(v))) throw new UnprocessableEntityException('El escenario contiene valores inválidos');
    if (input.soilMoisture < 0 || input.soilMoisture > 100 || input.cloudinessPercent < 0 || input.cloudinessPercent > 100 || input.rootRisk < 0 || input.rootRisk > 100 || input.dataConfidence < 0 || input.dataConfidence > 100) throw new UnprocessableEntityException('Valor porcentual fuera de rango');

    const blockers: string[] = [];
    if (input.dataConfidence < 60) blockers.push('LOW_DATA_CONFIDENCE');
    if (input.soilMoisture >= 90) blockers.push('SATURATION_RISK');
    if (input.drainagePercent < 10) blockers.push('POOR_DRAINAGE');
    if (input.rootRisk >= 70) blockers.push('HIGH_ROOT_RISK');
    if (!input.waterAvailable) blockers.push('WATER_UNAVAILABLE');
    if (input.forecastRainMm >= 5) blockers.push('RAIN_EXPECTED');

    let selectedAction = 'MONITOR';
    const rationale: string[] = [];
    if (input.ec >= 3 && input.soilMoisture >= 25 && input.drainagePercent >= 15 && blockers.length === 0) {
      selectedAction = 'PERFORM_LEACHING';
      rationale.push('CE elevada con humedad suficiente y drenaje operativo.');
      if (input.et0 >= 5 && input.cloudinessPercent >= 80) rationale.push('Existe contradicción entre demanda evaporativa alta y nubosidad alta; se exige reevaluación posterior.');
    } else if (input.soilMoisture < 20 && input.forecastRainMm < 3 && input.waterAvailable && input.dataConfidence >= 60) {
      selectedAction = 'IRRIGATE';
      rationale.push('Humedad baja, sin lluvia suficiente prevista y con agua disponible.');
    } else if (blockers.length) {
      selectedAction = 'VERIFY_OR_WAIT';
      rationale.push('La acción se bloquea por restricciones agronómicas u operativas.');
    } else rationale.push('No existe evidencia suficiente para intervenir inmediatamente.');

    return {
      modelCode: 'MVP-DAY-SIMULATOR', modelVersion: '1.0.0', selectedAction, blockers, rationale,
      nextDayIrrigation: selectedAction === 'PERFORM_LEACHING' ? 'LIKELY_NOT_REQUIRED_REEVALUATE' : 'CONTEXT_DEPENDENT',
      confidence: Math.max(0, Math.min(100, input.dataConfidence - blockers.length * 8)),
      persisted: false,
    };
  }
}
