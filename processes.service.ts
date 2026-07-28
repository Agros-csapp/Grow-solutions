import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { newId } from '../common/id';
import { Store } from '../common/store';
import { AgronomicProcess, OutcomeStatus, ProcessOutcome } from '../common/types';

interface MetricInput { code:string; expected:number; observed:number; tolerance:number; objective:'MIN'|'MAX'|'TARGET'; }

@Injectable()
export class ProcessesService {
  constructor(private readonly store:Store){}

  create(companyId:string,input:{upiId:string;recommendationId?:string;type:string;title:string;objective:string;priority:AgronomicProcess['priority']}):AgronomicProcess {
    if(!this.store.upis.some(u=>u.id===input.upiId&&u.companyId===companyId))throw new NotFoundException('UPI no encontrada');
    const incompatible=this.store.processes.find((p)=>p.companyId===companyId&&p.upiId===input.upiId&&!['COMPLETED','CANCELLED'].includes(p.status)&&this.incompatible(p.type,input.type));
    if(incompatible)throw new ConflictException(`Existe un proceso incompatible activo: ${incompatible.type}`);
    const p:AgronomicProcess={id:newId(),companyId,...input,status:'PLANNED',openedAt:new Date().toISOString()};this.store.addProcess(p);return p;
  }

  list(companyId:string){return this.store.processes.filter(p=>p.companyId===companyId).map((p)=>({...p,followUps:this.store.processFollowUps.filter(f=>f.processId===p.id),outcome:this.store.processOutcomes.find(o=>o.processId===p.id)}));}
  get(companyId:string,id:string){const p=this.find(companyId,id);return{...p,followUps:this.store.processFollowUps.filter(f=>f.processId===id),outcomes:this.store.processOutcomes.filter(o=>o.processId===id),protocolExecution:this.store.protocolExecutions.find(e=>e.processId===id)};}

  evaluate(companyId:string,id:string,input:{metrics:MetricInput[];confidence:number;evaluatedBy:string}):ProcessOutcome {
    const process=this.find(companyId,id);
    if(process.status!=='FOLLOW_UP'&&process.status!=='IN_PROGRESS')throw new ConflictException('El proceso no está listo para evaluación');
    if(!input.metrics.length)throw new UnprocessableEntityException('Se requiere al menos un indicador');
    const results=input.metrics.map((metric)=>({metric,passed:this.passed(metric),error:metric.observed-metric.expected}));
    const passCount=results.filter((r)=>r.passed).length;
    let status:OutcomeStatus=passCount===results.length?'SUCCESS':passCount>0?'PARTIAL':'NO_CHANGE';
    const rootRisk=results.find((r)=>r.metric.code==='ROOT_RISK');
    const ec=results.find((r)=>r.metric.code==='EC');
    if((rootRisk&&rootRisk.metric.observed>rootRisk.metric.expected+rootRisk.metric.tolerance)||(ec&&process.type==='PERFORM_LEACHING'&&ec.metric.observed>ec.metric.expected+ec.metric.tolerance))status='ADVERSE';
    if(input.confidence<50)status='NOT_VERIFIABLE';
    const outcome:ProcessOutcome={id:newId(),companyId,processId:id,expectedIndicators:Object.fromEntries(input.metrics.map((m)=>[m.code,m.expected])),observedIndicators:Object.fromEntries(input.metrics.map((m)=>[m.code,m.observed])),status,confidence:input.confidence,modelError:Object.fromEntries(results.map((r)=>[r.metric.code,r.error])),evaluatedAt:new Date().toISOString(),evaluatedBy:input.evaluatedBy};
    this.store.addProcessOutcome(outcome);
    if(status==='ADVERSE'||status==='NOT_VERIFIABLE'){
      process.status='FOLLOW_UP';this.store.updateProcess(process);
      const existing=this.store.processFollowUps.find((f)=>f.processId===id&&f.status==='PENDING');
      if(!existing)this.store.addProcessFollowUp({id:newId(),companyId,processId:id,dueAt:new Date(Date.now()+6*3600_000).toISOString(),variables:input.metrics.map((m)=>m.code),status:'PENDING',createdAt:new Date().toISOString()});
    }
    return outcome;
  }

  completeFollowUp(companyId:string,processId:string,followUpId:string):unknown {
    this.find(companyId,processId);
    const followUp=this.store.processFollowUps.find((f)=>f.id===followUpId&&f.processId===processId&&f.companyId===companyId);if(!followUp)throw new NotFoundException('Seguimiento no encontrado');
    followUp.status='COMPLETED';followUp.completedAt=new Date().toISOString();this.store.updateProcessFollowUp(followUp);return followUp;
  }

  close(companyId:string,id:string):AgronomicProcess {
    const process=this.find(companyId,id);
    const execution=this.store.protocolExecutions.find((e)=>e.processId===id&&e.companyId===companyId);
    if(!execution)throw new UnprocessableEntityException('El proceso no tiene protocolo ejecutado');
    const steps=this.store.protocolStepExecutions.filter((s)=>s.executionId===execution.id);
    if(!steps.length||steps.some((s)=>!['COMPLETED','SKIPPED'].includes(s.status)))throw new UnprocessableEntityException('Existen pasos obligatorios pendientes');
    const outcome=[...this.store.processOutcomes].filter((o)=>o.processId===id).sort((a,b)=>b.evaluatedAt.localeCompare(a.evaluatedAt))[0];
    if(!outcome)throw new UnprocessableEntityException('El proceso no tiene evaluación de resultado');
    if(!['SUCCESS','PARTIAL'].includes(outcome.status))throw new UnprocessableEntityException(`El resultado ${outcome.status} no permite cierre técnico`);
    const pending=this.store.processFollowUps.some((f)=>f.processId===id&&f.status==='PENDING');if(pending)throw new UnprocessableEntityException('Existen seguimientos pendientes');
    execution.status='COMPLETED';execution.completedAt=new Date().toISOString();this.store.updateProtocolExecution(execution);
    process.status='COMPLETED';this.store.updateProcess(process);
    if(process.recommendationId){const recommendation=this.store.recommendations.find((r)=>r.id===process.recommendationId);if(recommendation){recommendation.status='VERIFIED';this.store.updateRecommendation(recommendation);}}
    return process;
  }

  private passed(m:MetricInput):boolean { if(m.objective==='MIN')return m.observed<=m.expected+m.tolerance;if(m.objective==='MAX')return m.observed>=m.expected-m.tolerance;return Math.abs(m.observed-m.expected)<=m.tolerance; }
  private incompatible(a:string,b:string):boolean { const pairs=[['PERFORM_LEACHING','IRRIGATE'],['IRRIGATE','PERFORM_LEACHING']];return pairs.some(([x,y])=>a===x&&b===y); }
  private find(companyId:string,id:string){const p=this.store.processes.find(x=>x.id===id&&x.companyId===companyId);if(!p)throw new NotFoundException('Proceso no encontrado');return p;}
}
