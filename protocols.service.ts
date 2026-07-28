import { ConflictException, Injectable, NotFoundException, OnModuleInit, UnprocessableEntityException } from '@nestjs/common';
import { newId } from '../common/id';
import { Store } from '../common/store';
import { AgronomicProcess, ProcessFollowUp, ProtocolDefinition, ProtocolExecution, ProtocolStepDefinition, ProtocolStepExecution } from '../common/types';

@Injectable()
export class ProtocolsService implements OnModuleInit {
  constructor(private readonly store: Store) {}

  onModuleInit(): void { this.seedSystemProtocols(); }

  private seedSystemProtocols(): void {
    const definitions: Array<Omit<ProtocolDefinition, 'id'>> = [
      {
        code: 'ATP-LEACHING-001', name: 'Lavado controlado de sales', processType: 'PERFORM_LEACHING', version: 1,
        objective: 'Reducir la CE preservando la oxigenación radicular.', status: 'ACTIVE',
        steps: [
          this.step(1, 'Verificar condiciones previas', 'Confirmar humedad, drenaje, disponibilidad de agua y riesgo radicular.', true, true, ['SOIL_MOISTURE','DRAINAGE_PERCENT','ROOT_RISK']),
          this.step(2, 'Confirmar lámina y ventana', 'Registrar la lámina aprobada y la ventana de ejecución.', true, false, ['LEACHING_DEPTH_MM']),
          this.step(3, 'Ejecutar lavado', 'Aplicar la lámina aprobada y registrar evidencia de ejecución.', true, true, ['APPLIED_DEPTH_MM']),
          this.step(4, 'Medir drenaje', 'Registrar el porcentaje de drenaje obtenido.', true, true, ['DRAINAGE_PERCENT']),
          this.step(5, 'Programar seguimiento', 'Programar verificación de CE, humedad y riesgo radicular.', true, false, []),
        ],
      },
      {
        code: 'ATP-IRRIGATION-001', name: 'Riego ajustado', processType: 'IRRIGATE', version: 1,
        objective: 'Corregir déficit hídrico sin generar exceso ni deterioro radicular.', status: 'ACTIVE',
        steps: [
          this.step(1, 'Verificar déficit', 'Confirmar humedad, demanda y disponibilidad operativa.', true, true, ['SOIL_MOISTURE','ET0']),
          this.step(2, 'Confirmar lámina', 'Registrar la lámina aprobada.', true, false, ['APPLIED_DEPTH_MM']),
          this.step(3, 'Ejecutar riego', 'Aplicar riego y registrar evidencia.', true, true, ['APPLIED_DEPTH_MM']),
          this.step(4, 'Programar seguimiento', 'Programar verificación posterior de humedad y drenaje.', true, false, []),
        ],
      },
      {
        code: 'ATP-MEASUREMENT-001', name: 'Verificación de datos', processType: 'REQUEST_MEASUREMENT', version: 1,
        objective: 'Obtener evidencia suficiente antes de intervenir.', status: 'ACTIVE',
        steps: [
          this.step(1, 'Inspeccionar fuente', 'Verificar instrumento, ubicación y vigencia de calibración.', true, true, []),
          this.step(2, 'Tomar nuevas mediciones', 'Registrar las variables faltantes o de baja confianza.', true, true, []),
          this.step(3, 'Validar consistencia', 'Comparar las nuevas mediciones con el historial.', true, false, []),
        ],
      },
    ];
    for (const definition of definitions) {
      if (!this.store.protocols.some((p) => p.code === definition.code && p.version === definition.version && !p.companyId)) {
        this.store.addProtocol({ id: newId(), ...definition });
      }
    }
  }

  private step(stepNumber:number, title:string, instruction:string, isCritical:boolean, evidenceRequired:boolean, requiredVariables:string[]):ProtocolStepDefinition {
    return { id:newId(), stepNumber, title, instruction, isCritical, evidenceRequired, requiredVariables, acceptanceCriteria:{} };
  }

  list(companyId:string): ProtocolDefinition[] {
    return this.store.protocols.filter((p) => !p.companyId || p.companyId === companyId).filter((p) => p.status === 'ACTIVE');
  }

  start(companyId:string, processId:string, protocolCode?:string): { execution:ProtocolExecution; steps:ProtocolStepExecution[]; protocol:ProtocolDefinition } {
    const process = this.findProcess(companyId, processId);
    if (this.store.protocolExecutions.some((e) => e.processId === processId && !['COMPLETED'].includes(e.status))) throw new ConflictException('El proceso ya tiene un protocolo activo');
    const candidates = this.list(companyId).filter((p) => p.processType === process.type);
    const protocol = protocolCode ? candidates.find((p) => p.code === protocolCode) : candidates.sort((a,b)=>b.version-a.version)[0];
    if (!protocol) throw new UnprocessableEntityException('No existe protocolo activo compatible con el proceso');
    const now = new Date().toISOString();
    const execution:ProtocolExecution = { id:newId(), companyId, processId, protocolId:protocol.id, protocolVersion:protocol.version, status:'IN_PROGRESS', startedAt:now };
    this.store.addProtocolExecution(execution);
    const steps = protocol.steps.map((step,index):ProtocolStepExecution => ({ id:newId(), companyId, executionId:execution.id, stepId:step.id, status:index===0?'AVAILABLE':'PENDING', evidenceCount:0, enteredValues:{} }));
    steps.forEach((step) => this.store.addProtocolStepExecution(step));
    process.status = 'IN_PROGRESS'; this.store.updateProcess(process);
    return { execution, steps, protocol };
  }

  executeStep(companyId:string, processId:string, stepId:string, input:{executedBy:string;evidenceCount:number;enteredValues:Record<string,number|string|boolean>}):ProtocolStepExecution {
    const { execution, protocol } = this.context(companyId, processId);
    const definition = protocol.steps.find((s) => s.id === stepId);
    if (!definition) throw new NotFoundException('Paso no encontrado');
    const step = this.store.protocolStepExecutions.find((s) => s.executionId === execution.id && s.stepId === stepId);
    if (!step) throw new NotFoundException('Ejecución de paso no encontrada');
    if (step.status !== 'AVAILABLE' && step.status !== 'IN_PROGRESS') throw new ConflictException('El paso no está disponible');
    if (definition.evidenceRequired && input.evidenceCount < 1) throw new UnprocessableEntityException('El paso requiere evidencia');
    const missing = definition.requiredVariables.filter((code) => input.enteredValues[code] === undefined);
    if (missing.length) throw new UnprocessableEntityException(`Faltan variables requeridas: ${missing.join(', ')}`);
    const now = new Date().toISOString();
    step.status='COMPLETED'; step.startedAt=step.startedAt??now; step.completedAt=now; step.executedBy=input.executedBy; step.evidenceCount=input.evidenceCount; step.enteredValues=input.enteredValues;
    this.store.updateProtocolStepExecution(step);
    const ordered = protocol.steps.sort((a,b)=>a.stepNumber-b.stepNumber);
    const currentIndex=ordered.findIndex((s)=>s.id===stepId);
    const nextDef=ordered[currentIndex+1];
    if (nextDef) {
      const next=this.store.protocolStepExecutions.find((s)=>s.executionId===execution.id&&s.stepId===nextDef.id)!;
      next.status='AVAILABLE'; this.store.updateProtocolStepExecution(next);
    } else {
      execution.status='FOLLOW_UP'; this.store.updateProtocolExecution(execution);
      const process=this.findProcess(companyId,processId); process.status='FOLLOW_UP'; this.store.updateProcess(process);
      this.scheduleFollowUp(companyId, process);
    }
    return step;
  }

  skipStep(companyId:string, processId:string, stepId:string, input:{executedBy:string;reason:string}):ProtocolStepExecution {
    const { execution, protocol }=this.context(companyId,processId);
    const definition=protocol.steps.find((s)=>s.id===stepId); if(!definition)throw new NotFoundException('Paso no encontrado');
    if(definition.isCritical)throw new UnprocessableEntityException('Un paso crítico no puede omitirse');
    const step=this.store.protocolStepExecutions.find((s)=>s.executionId===execution.id&&s.stepId===stepId); if(!step)throw new NotFoundException('Ejecución no encontrada');
    step.status='SKIPPED';step.executedBy=input.executedBy;step.omissionReason=input.reason;step.completedAt=new Date().toISOString();this.store.updateProtocolStepExecution(step);return step;
  }

  suspend(companyId:string, processId:string):ProtocolExecution { const {execution}=this.context(companyId,processId); execution.status='SUSPENDED';this.store.updateProtocolExecution(execution);const p=this.findProcess(companyId,processId);p.status='SUSPENDED';this.store.updateProcess(p);return execution; }
  resume(companyId:string, processId:string):ProtocolExecution { const {execution}=this.context(companyId,processId);if(execution.status!=='SUSPENDED')throw new ConflictException('El protocolo no está suspendido');execution.status='IN_PROGRESS';this.store.updateProtocolExecution(execution);const p=this.findProcess(companyId,processId);p.status='IN_PROGRESS';this.store.updateProcess(p);return execution; }

  getExecution(companyId:string, processId:string) {
    const {execution,protocol}=this.context(companyId,processId);
    const steps=this.store.protocolStepExecutions.filter((s)=>s.companyId===companyId&&s.executionId===execution.id).map((executionStep)=>({ ...executionStep, definition:protocol.steps.find((d)=>d.id===executionStep.stepId) }));
    return {execution,protocol,steps};
  }

  private scheduleFollowUp(companyId:string, process:AgronomicProcess):ProcessFollowUp {
    const variables = process.type === 'PERFORM_LEACHING' ? ['EC','SOIL_MOISTURE','DRAINAGE_PERCENT','ROOT_RISK'] : process.type === 'IRRIGATE' ? ['SOIL_MOISTURE','DRAINAGE_PERCENT'] : ['DATA_CONFIDENCE'];
    const hours=process.type==='PERFORM_LEACHING'?24:12;
    const followUp:ProcessFollowUp={id:newId(),companyId,processId:process.id,dueAt:new Date(Date.now()+hours*3600_000).toISOString(),variables,status:'PENDING',createdAt:new Date().toISOString()};
    this.store.addProcessFollowUp(followUp);return followUp;
  }

  private context(companyId:string, processId:string){
    this.findProcess(companyId,processId);
    const execution=[...this.store.protocolExecutions].filter((e)=>e.companyId===companyId&&e.processId===processId).sort((a,b)=>(b.startedAt??'').localeCompare(a.startedAt??''))[0];
    if(!execution)throw new NotFoundException('El proceso no tiene protocolo');
    const protocol=this.store.protocols.find((p)=>p.id===execution.protocolId);if(!protocol)throw new NotFoundException('Protocolo no encontrado');return{execution,protocol};
  }
  private findProcess(companyId:string,id:string){const process=this.store.processes.find((p)=>p.id===id&&p.companyId===companyId);if(!process)throw new NotFoundException('Proceso no encontrado');return process;}
}
