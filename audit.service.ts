import { Injectable } from '@nestjs/common';
import { Store } from '../common/store';
@Injectable() export class AuditService { constructor(private readonly store:Store){} list(companyId:string){ return this.store.listAudit(companyId); } }
