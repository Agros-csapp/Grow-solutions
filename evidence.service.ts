import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { newId } from '../common/id';
import { Store } from '../common/store';
import { Evidence, EvidenceType } from '../common/types';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg','image/png','image/webp','application/pdf']);
@Injectable()
export class EvidenceService {
  constructor(private readonly store:Store){}
  create(companyId:string,userId:string,input:{upiId:string;processId?:string;taskId?:string;observationId?:string;evidenceType:EvidenceType;originalFilename:string;mimeType:string;contentBase64:string;capturedAt:string;description?:string;phase?:'BEFORE'|'DURING'|'AFTER'}){
    if(!this.store.upis.some(u=>u.id===input.upiId&&u.companyId===companyId)) throw new NotFoundException('UPI no encontrada');
    if(!ALLOWED.has(input.mimeType)) throw new BadRequestException('Tipo de archivo no permitido');
    const buffer=Buffer.from(input.contentBase64,'base64');
    if(!buffer.length||buffer.length>MAX_BYTES) throw new BadRequestException('Archivo vacío o superior a 5 MB');
    const checksum=createHash('sha256').update(buffer).digest('hex');
    if(this.store.evidence.some(e=>e.companyId===companyId&&e.checksumSha256===checksum)) throw new ConflictException('La evidencia ya fue registrada');
    if(input.processId&&!this.store.processes.some(p=>p.id===input.processId&&p.companyId===companyId&&p.upiId===input.upiId)) throw new BadRequestException('Proceso incompatible');
    if(input.taskId&&!this.store.tasks.some(t=>t.id===input.taskId&&t.companyId===companyId&&t.upiId===input.upiId)) throw new BadRequestException('Tarea incompatible');
    const id=newId(); const ext=input.mimeType==='application/pdf'?'pdf':input.mimeType.split('/')[1].replace('jpeg','jpg');
    const storagePath=resolve(process.cwd(),process.env.AGROS_EVIDENCE_DIR??'data/evidence',companyId,input.upiId,`${id}.${ext}`);
    mkdirSync(dirname(storagePath),{recursive:true}); writeFileSync(storagePath,buffer,{flag:'wx'});
    const value:Evidence={id,companyId,upiId:input.upiId,processId:input.processId,taskId:input.taskId,observationId:input.observationId,evidenceType:input.evidenceType,originalFilename:input.originalFilename,mimeType:input.mimeType,fileSizeBytes:buffer.length,checksumSha256:checksum,storagePath,capturedAt:input.capturedAt,uploadedAt:new Date().toISOString(),uploadedBy:userId,description:input.description,phase:input.phase};
    this.store.addEvidence(value);
    if(input.taskId){const task=this.store.tasks.find(t=>t.id===input.taskId&&t.companyId===companyId);if(task){task.evidenceCount++;this.store.updateTask(task)}}
    return this.publicView(value);
  }
  list(companyId:string,upiId:string){return this.store.evidence.filter(e=>e.companyId===companyId&&e.upiId===upiId).sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt)).map(e=>this.publicView(e));}
  compare(companyId:string,processId:string){const all=this.store.evidence.filter(e=>e.companyId===companyId&&e.processId===processId);return{before:all.filter(e=>e.phase==='BEFORE').map(e=>this.publicView(e)),after:all.filter(e=>e.phase==='AFTER').map(e=>this.publicView(e)),complete:all.some(e=>e.phase==='BEFORE')&&all.some(e=>e.phase==='AFTER')}}
  getFile(companyId:string,id:string){const e=this.store.evidence.find(x=>x.id===id&&x.companyId===companyId);if(!e||!existsSync(e.storagePath))throw new NotFoundException('Evidencia no encontrada');return{evidence:e,buffer:readFileSync(e.storagePath)}}
  private publicView(e:Evidence){const{storagePath,...safe}=e;return safe;}
}
