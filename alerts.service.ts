import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '../common/id';
import { Store } from '../common/store';
import { Alert, AlertSeverity } from '../common/types';

const severityBase: Record<AlertSeverity, number> = { INFORMATIONAL:10, PREVENTIVE:30, MEDIUM:50, HIGH:75, CRITICAL:95 };
@Injectable()
export class AlertsService {
  constructor(private readonly store: Store) {}
  create(companyId:string,input:{upiId:string;type:string;severity:AlertSeverity;title:string;description:string;sourceType:string;sourceId:string}):Alert{
    if(!this.store.upis.some(u=>u.id===input.upiId&&u.companyId===companyId)) throw new NotFoundException('UPI no encontrada');
    const duplicate=this.store.alerts.find(a=>a.companyId===companyId&&a.sourceType===input.sourceType&&a.sourceId===input.sourceId&&a.type===input.type&&a.status!=='RESOLVED');
    if(duplicate) throw new ConflictException('Ya existe una alerta activa para esta condición');
    const alert:Alert={id:newId(),companyId,...input,priorityScore:severityBase[input.severity],status:'OPEN',detectedAt:new Date().toISOString()};
    this.store.addAlert(alert); return alert;
  }
  list(companyId:string){return this.store.alerts.filter(a=>a.companyId===companyId).sort((a,b)=>b.priorityScore-a.priorityScore)}
  acknowledge(companyId:string,id:string){const a=this.find(companyId,id);a.status='ACKNOWLEDGED';this.store.updateAlert(a);return a}
  resolve(companyId:string,id:string){const a=this.find(companyId,id);a.status='RESOLVED';this.store.updateAlert(a);return a}
  private find(companyId:string,id:string){const a=this.store.alerts.find(x=>x.id===id&&x.companyId===companyId);if(!a)throw new NotFoundException('Alerta no encontrada');return a}
}
