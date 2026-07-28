import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { DatabaseSync } from 'node:sqlite';
import { AgronomicProcess, Alert, AuthUser, Block, Company, DecisionAnalysis, Farm, Irrigation, Observation, Evidence, ProcessFollowUp, ProcessOutcome, ProtocolDefinition, ProtocolExecution, ProtocolStepExecution, Reading, Recommendation, Task, Upi } from './types';

interface PersistedUser extends AuthUser { passwordHash: string }

@Injectable()
export class Store implements OnApplicationShutdown {
  private readonly db: DatabaseSync;
  users: AuthUser[] = [];
  passwordHashes = new Map<string,string>();
  companies: Company[] = [];
  farms: Farm[] = [];
  blocks: Block[] = [];
  upis: Upi[] = [];
  observations: Observation[] = [];
  readings: Reading[] = [];
  irrigations: Irrigation[] = [];
  alerts: Alert[] = [];
  recommendations: Recommendation[] = [];
  processes: AgronomicProcess[] = [];
  tasks: Task[] = [];
  decisionAnalyses: DecisionAnalysis[] = [];
  protocols: ProtocolDefinition[] = [];
  protocolExecutions: ProtocolExecution[] = [];
  protocolStepExecutions: ProtocolStepExecution[] = [];
  processOutcomes: ProcessOutcome[] = [];
  processFollowUps: ProcessFollowUp[] = [];
  evidence: Evidence[] = [];

  constructor() {
    const configured = process.env.AGROS_DB_PATH;
    const dbPath = configured ?? (process.env.NODE_ENV === 'test' ? ':memory:' : resolve(process.cwd(), 'data/agros.db'));
    if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.migrate();
    this.load();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY, legal_name TEXT NOT NULL, tax_identifier TEXT NOT NULL,
        country_code TEXT NOT NULL, UNIQUE(tax_identifier, country_code)
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
        email TEXT NOT NULL, roles_json TEXT NOT NULL, password_hash TEXT NOT NULL,
        UNIQUE(company_id, email)
      );
      CREATE TABLE IF NOT EXISTS farms (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
        code TEXT NOT NULL, name TEXT NOT NULL, total_area_ha REAL NOT NULL CHECK(total_area_ha > 0),
        UNIQUE(company_id, code)
      );
      CREATE TABLE IF NOT EXISTS blocks (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
        farm_id TEXT NOT NULL REFERENCES farms(id), code TEXT NOT NULL, name TEXT NOT NULL,
        area_ha REAL NOT NULL CHECK(area_ha > 0), UNIQUE(farm_id, code)
      );
      CREATE TABLE IF NOT EXISTS upis (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
        block_id TEXT NOT NULL REFERENCES blocks(id), code TEXT NOT NULL, name TEXT NOT NULL,
        area_m2 REAL NOT NULL CHECK(area_m2 > 0), crop TEXT NOT NULL, variety TEXT NOT NULL,
        field_capacity REAL, wilting_point REAL, status TEXT NOT NULL,
        CHECK(field_capacity IS NULL OR wilting_point IS NULL OR field_capacity > wilting_point),
        UNIQUE(company_id, code)
      );
      CREATE TABLE IF NOT EXISTS observations (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
        upi_id TEXT NOT NULL REFERENCES upis(id), category TEXT NOT NULL, severity TEXT NOT NULL,
        description TEXT NOT NULL, observed_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS readings (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
        upi_id TEXT NOT NULL REFERENCES upis(id), variable_code TEXT NOT NULL,
        value REAL NOT NULL, unit TEXT NOT NULL, measured_at TEXT NOT NULL, confidence REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_readings_upi_variable_time ON readings(upi_id, variable_code, measured_at DESC);
      CREATE TABLE IF NOT EXISTS irrigations (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
        upi_id TEXT NOT NULL REFERENCES upis(id), start_at TEXT NOT NULL, end_at TEXT NOT NULL,
        flow_rate_m3h REAL NOT NULL, applied_volume_l REAL NOT NULL, gross_depth_mm REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_irrigations_upi_start ON irrigations(upi_id, start_at DESC);
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), upi_id TEXT NOT NULL REFERENCES upis(id),
        type TEXT NOT NULL, severity TEXT NOT NULL, priority_score REAL NOT NULL, title TEXT NOT NULL,
        description TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL, status TEXT NOT NULL, detected_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_active_source ON alerts(company_id, source_type, source_id, type) WHERE status IN ('OPEN','ACKNOWLEDGED');
      CREATE TABLE IF NOT EXISTS recommendations (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), upi_id TEXT NOT NULL REFERENCES upis(id),
        action_code TEXT NOT NULL, action_description TEXT NOT NULL, priority TEXT NOT NULL, confidence REAL NOT NULL,
        rationale_json TEXT NOT NULL, alternatives_json TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, valid_until TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agronomic_processes (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), upi_id TEXT NOT NULL REFERENCES upis(id),
        recommendation_id TEXT, type TEXT NOT NULL, title TEXT NOT NULL, objective TEXT NOT NULL, priority TEXT NOT NULL,
        status TEXT NOT NULL, opened_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), upi_id TEXT NOT NULL REFERENCES upis(id),
        process_id TEXT, title TEXT NOT NULL, description TEXT NOT NULL, assigned_to TEXT NOT NULL,
        priority TEXT NOT NULL, due_at TEXT NOT NULL, status TEXT NOT NULL, evidence_required INTEGER NOT NULL, evidence_count INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS decision_analyses (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), upi_id TEXT NOT NULL REFERENCES upis(id),
        model_code TEXT NOT NULL, model_version TEXT NOT NULL, created_at TEXT NOT NULL, confidence REAL NOT NULL,
        context_json TEXT NOT NULL, factors_json TEXT NOT NULL, missing_json TEXT NOT NULL, contradictions_json TEXT NOT NULL,
        alternatives_json TEXT NOT NULL, selected_action TEXT NOT NULL, rationale_json TEXT NOT NULL, follow_up_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS protocols (
        id TEXT PRIMARY KEY, company_id TEXT, code TEXT NOT NULL, name TEXT NOT NULL, process_type TEXT NOT NULL,
        version INTEGER NOT NULL, objective TEXT NOT NULL, status TEXT NOT NULL, steps_json TEXT NOT NULL,
        UNIQUE(company_id, code, version)
      );
      CREATE TABLE IF NOT EXISTS protocol_executions (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL, process_id TEXT NOT NULL REFERENCES agronomic_processes(id),
        protocol_id TEXT NOT NULL REFERENCES protocols(id), protocol_version INTEGER NOT NULL, status TEXT NOT NULL,
        started_at TEXT, completed_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_active_protocol_execution ON protocol_executions(process_id) WHERE status IN ('PLANNED','IN_PROGRESS','FOLLOW_UP','SUSPENDED');
      CREATE TABLE IF NOT EXISTS protocol_step_executions (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL, execution_id TEXT NOT NULL REFERENCES protocol_executions(id),
        step_id TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT, completed_at TEXT, executed_by TEXT,
        evidence_count INTEGER NOT NULL, entered_values_json TEXT NOT NULL, omission_reason TEXT,
        UNIQUE(execution_id, step_id)
      );
      CREATE TABLE IF NOT EXISTS process_outcomes (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL, process_id TEXT NOT NULL REFERENCES agronomic_processes(id),
        expected_json TEXT NOT NULL, observed_json TEXT NOT NULL, status TEXT NOT NULL, confidence REAL NOT NULL,
        model_error_json TEXT NOT NULL, evaluated_at TEXT NOT NULL, evaluated_by TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS process_follow_ups (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL, process_id TEXT NOT NULL REFERENCES agronomic_processes(id),
        due_at TEXT NOT NULL, variables_json TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS evidence (
        id TEXT PRIMARY KEY, company_id TEXT NOT NULL, upi_id TEXT NOT NULL REFERENCES upis(id),
        process_id TEXT, task_id TEXT, observation_id TEXT, evidence_type TEXT NOT NULL,
        original_filename TEXT NOT NULL, mime_type TEXT NOT NULL, file_size_bytes INTEGER NOT NULL,
        checksum_sha256 TEXT NOT NULL, storage_path TEXT NOT NULL, captured_at TEXT NOT NULL,
        uploaded_at TEXT NOT NULL, uploaded_by TEXT NOT NULL, description TEXT, phase TEXT,
        UNIQUE(company_id, checksum_sha256)
      );
      CREATE INDEX IF NOT EXISTS ix_evidence_upi_time ON evidence(upi_id, captured_at DESC);
      CREATE INDEX IF NOT EXISTS ix_decision_analyses_upi_time ON decision_analyses(upi_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT, action TEXT NOT NULL,
        entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, occurred_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_logs(entity_type, entity_id, occurred_at DESC);
    `);
  }

  private rows<T>(sql: string): T[] { return this.db.prepare(sql).all() as T[]; }

  private load(): void {
    this.companies = this.rows<{id:string;legal_name:string;tax_identifier:string;country_code:string}>('SELECT * FROM companies')
      .map(r => ({id:r.id,legalName:r.legal_name,taxIdentifier:r.tax_identifier,countryCode:r.country_code}));
    const users = this.rows<{id:string;company_id:string;email:string;roles_json:string;password_hash:string}>('SELECT * FROM users');
    this.users = users.map(r => ({id:r.id,companyId:r.company_id,email:r.email,roles:JSON.parse(r.roles_json)}));
    users.forEach(r => this.passwordHashes.set(r.id,r.password_hash));
    this.farms = this.rows<{id:string;company_id:string;code:string;name:string;total_area_ha:number}>('SELECT * FROM farms')
      .map(r => ({id:r.id,companyId:r.company_id,code:r.code,name:r.name,totalAreaHa:r.total_area_ha}));
    this.blocks = this.rows<{id:string;company_id:string;farm_id:string;code:string;name:string;area_ha:number}>('SELECT * FROM blocks')
      .map(r => ({id:r.id,companyId:r.company_id,farmId:r.farm_id,code:r.code,name:r.name,areaHa:r.area_ha}));
    this.upis = this.rows<{id:string;company_id:string;block_id:string;code:string;name:string;area_m2:number;crop:string;variety:string;field_capacity:number|null;wilting_point:number|null;status:Upi['status']}>('SELECT * FROM upis')
      .map(r => ({id:r.id,companyId:r.company_id,blockId:r.block_id,code:r.code,name:r.name,areaM2:r.area_m2,crop:r.crop,variety:r.variety,fieldCapacity:r.field_capacity??undefined,wiltingPoint:r.wilting_point??undefined,status:r.status}));
    this.observations = this.rows<{id:string;company_id:string;upi_id:string;category:string;severity:string;description:string;observed_at:string}>('SELECT * FROM observations')
      .map(r => ({id:r.id,companyId:r.company_id,upiId:r.upi_id,category:r.category,severity:r.severity,description:r.description,observedAt:r.observed_at}));
    this.readings = this.rows<{id:string;company_id:string;upi_id:string;variable_code:string;value:number;unit:string;measured_at:string;confidence:number}>('SELECT * FROM readings')
      .map(r => ({id:r.id,companyId:r.company_id,upiId:r.upi_id,variableCode:r.variable_code,value:r.value,unit:r.unit,measuredAt:r.measured_at,confidence:r.confidence}));
    this.irrigations = this.rows<{id:string;company_id:string;upi_id:string;start_at:string;end_at:string;flow_rate_m3h:number;applied_volume_l:number;gross_depth_mm:number}>('SELECT * FROM irrigations')
      .map(r => ({id:r.id,companyId:r.company_id,upiId:r.upi_id,startAt:r.start_at,endAt:r.end_at,flowRateM3h:r.flow_rate_m3h,appliedVolumeL:r.applied_volume_l,grossDepthMm:r.gross_depth_mm}));
    this.alerts = this.rows<any>('SELECT * FROM alerts').map(r=>({id:r.id,companyId:r.company_id,upiId:r.upi_id,type:r.type,severity:r.severity,priorityScore:r.priority_score,title:r.title,description:r.description,sourceType:r.source_type,sourceId:r.source_id,status:r.status,detectedAt:r.detected_at}));
    this.recommendations = this.rows<any>('SELECT * FROM recommendations').map(r=>({id:r.id,companyId:r.company_id,upiId:r.upi_id,actionCode:r.action_code,actionDescription:r.action_description,priority:r.priority,confidence:r.confidence,rationale:JSON.parse(r.rationale_json),alternatives:JSON.parse(r.alternatives_json),status:r.status,createdAt:r.created_at,validUntil:r.valid_until}));
    this.processes = this.rows<any>('SELECT * FROM agronomic_processes').map(r=>({id:r.id,companyId:r.company_id,upiId:r.upi_id,recommendationId:r.recommendation_id??undefined,type:r.type,title:r.title,objective:r.objective,priority:r.priority,status:r.status,openedAt:r.opened_at}));
    this.tasks = this.rows<any>('SELECT * FROM tasks').map(r=>({id:r.id,companyId:r.company_id,upiId:r.upi_id,processId:r.process_id??undefined,title:r.title,description:r.description,assignedTo:r.assigned_to,priority:r.priority,dueAt:r.due_at,status:r.status,evidenceRequired:Boolean(r.evidence_required),evidenceCount:r.evidence_count}));
    this.decisionAnalyses = this.rows<any>('SELECT * FROM decision_analyses').map(r=>({id:r.id,companyId:r.company_id,upiId:r.upi_id,modelCode:r.model_code,modelVersion:r.model_version,createdAt:r.created_at,confidence:r.confidence,contextStatus:JSON.parse(r.context_json),factors:JSON.parse(r.factors_json),missingVariables:JSON.parse(r.missing_json),contradictions:JSON.parse(r.contradictions_json),alternatives:JSON.parse(r.alternatives_json),selectedAction:r.selected_action,rationale:JSON.parse(r.rationale_json),followUp:JSON.parse(r.follow_up_json)}));
    this.protocols = this.rows<any>('SELECT * FROM protocols').map(r=>({id:r.id,companyId:r.company_id??undefined,code:r.code,name:r.name,processType:r.process_type,version:r.version,objective:r.objective,status:r.status,steps:JSON.parse(r.steps_json)}));
    this.protocolExecutions = this.rows<any>('SELECT * FROM protocol_executions').map(r=>({id:r.id,companyId:r.company_id,processId:r.process_id,protocolId:r.protocol_id,protocolVersion:r.protocol_version,status:r.status,startedAt:r.started_at??undefined,completedAt:r.completed_at??undefined}));
    this.protocolStepExecutions = this.rows<any>('SELECT * FROM protocol_step_executions').map(r=>({id:r.id,companyId:r.company_id,executionId:r.execution_id,stepId:r.step_id,status:r.status,startedAt:r.started_at??undefined,completedAt:r.completed_at??undefined,executedBy:r.executed_by??undefined,evidenceCount:r.evidence_count,enteredValues:JSON.parse(r.entered_values_json),omissionReason:r.omission_reason??undefined}));
    this.processOutcomes = this.rows<any>('SELECT * FROM process_outcomes').map(r=>({id:r.id,companyId:r.company_id,processId:r.process_id,expectedIndicators:JSON.parse(r.expected_json),observedIndicators:JSON.parse(r.observed_json),status:r.status,confidence:r.confidence,modelError:JSON.parse(r.model_error_json),evaluatedAt:r.evaluated_at,evaluatedBy:r.evaluated_by}));
    this.processFollowUps = this.rows<any>('SELECT * FROM process_follow_ups').map(r=>({id:r.id,companyId:r.company_id,processId:r.process_id,dueAt:r.due_at,variables:JSON.parse(r.variables_json),status:r.status,createdAt:r.created_at,completedAt:r.completed_at??undefined}));
    this.evidence = this.rows<any>('SELECT * FROM evidence').map(r=>({id:r.id,companyId:r.company_id,upiId:r.upi_id,processId:r.process_id??undefined,taskId:r.task_id??undefined,observationId:r.observation_id??undefined,evidenceType:r.evidence_type,originalFilename:r.original_filename,mimeType:r.mime_type,fileSizeBytes:r.file_size_bytes,checksumSha256:r.checksum_sha256,storagePath:r.storage_path,capturedAt:r.captured_at,uploadedAt:r.uploaded_at,uploadedBy:r.uploaded_by,description:r.description??undefined,phase:r.phase??undefined}));
  }

  private audit(companyId:string|undefined, action:string, entityType:string, entityId:string, payload:unknown):void {
    this.db.prepare('INSERT INTO audit_logs(company_id,action,entity_type,entity_id,occurred_at,payload_json) VALUES(?,?,?,?,?,?)')
      .run(companyId??null,action,entityType,entityId,new Date().toISOString(),JSON.stringify(payload));
  }

  addCompany(value:Company):void { this.db.prepare('INSERT INTO companies VALUES(?,?,?,?)').run(value.id,value.legalName,value.taxIdentifier,value.countryCode); this.companies.push(value); this.audit(value.id,'CREATE','COMPANY',value.id,value); }
  addUser(value:PersistedUser):void { this.db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(value.id,value.companyId,value.email,JSON.stringify(value.roles),value.passwordHash); this.users.push({id:value.id,companyId:value.companyId,email:value.email,roles:value.roles}); this.passwordHashes.set(value.id,value.passwordHash); this.audit(value.companyId,'CREATE','USER',value.id,{email:value.email,roles:value.roles}); }
  addFarm(value:Farm):void { this.db.prepare('INSERT INTO farms VALUES(?,?,?,?,?)').run(value.id,value.companyId,value.code,value.name,value.totalAreaHa); this.farms.push(value); this.audit(value.companyId,'CREATE','FARM',value.id,value); }
  addBlock(value:Block):void { this.db.prepare('INSERT INTO blocks VALUES(?,?,?,?,?,?)').run(value.id,value.companyId,value.farmId,value.code,value.name,value.areaHa); this.blocks.push(value); this.audit(value.companyId,'CREATE','BLOCK',value.id,value); }
  addUpi(value:Upi):void { this.db.prepare('INSERT INTO upis VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(value.id,value.companyId,value.blockId,value.code,value.name,value.areaM2,value.crop,value.variety,value.fieldCapacity??null,value.wiltingPoint??null,value.status); this.upis.push(value); this.audit(value.companyId,'CREATE','UPI',value.id,value); }
  addObservation(value:Observation):void { this.db.prepare('INSERT INTO observations VALUES(?,?,?,?,?,?,?)').run(value.id,value.companyId,value.upiId,value.category,value.severity,value.description,value.observedAt); this.observations.push(value); this.audit(value.companyId,'CREATE','OBSERVATION',value.id,value); }
  addReading(value:Reading):void { this.db.prepare('INSERT INTO readings VALUES(?,?,?,?,?,?,?,?)').run(value.id,value.companyId,value.upiId,value.variableCode,value.value,value.unit,value.measuredAt,value.confidence); this.readings.push(value); this.audit(value.companyId,'CREATE','READING',value.id,value); }
  addIrrigation(value:Irrigation):void { this.db.prepare('INSERT INTO irrigations VALUES(?,?,?,?,?,?,?,?)').run(value.id,value.companyId,value.upiId,value.startAt,value.endAt,value.flowRateM3h,value.appliedVolumeL,value.grossDepthMm); this.irrigations.push(value); this.audit(value.companyId,'CREATE','IRRIGATION',value.id,value); }
  addAlert(value:Alert):void { this.db.prepare('INSERT INTO alerts VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(value.id,value.companyId,value.upiId,value.type,value.severity,value.priorityScore,value.title,value.description,value.sourceType,value.sourceId,value.status,value.detectedAt); this.alerts.push(value); this.audit(value.companyId,'CREATE','ALERT',value.id,value); }
  updateAlert(value:Alert):void { this.db.prepare('UPDATE alerts SET severity=?,priority_score=?,title=?,description=?,status=? WHERE id=? AND company_id=?').run(value.severity,value.priorityScore,value.title,value.description,value.status,value.id,value.companyId); const i=this.alerts.findIndex(x=>x.id===value.id); if(i>=0)this.alerts[i]=value; this.audit(value.companyId,'UPDATE','ALERT',value.id,value); }
  addRecommendation(value:Recommendation):void { this.db.prepare('INSERT INTO recommendations VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(value.id,value.companyId,value.upiId,value.actionCode,value.actionDescription,value.priority,value.confidence,JSON.stringify(value.rationale),JSON.stringify(value.alternatives),value.status,value.createdAt,value.validUntil); this.recommendations.push(value); this.audit(value.companyId,'CREATE','RECOMMENDATION',value.id,value); }
  updateRecommendation(value:Recommendation):void { this.db.prepare('UPDATE recommendations SET status=? WHERE id=? AND company_id=?').run(value.status,value.id,value.companyId); const i=this.recommendations.findIndex(x=>x.id===value.id); if(i>=0)this.recommendations[i]=value; this.audit(value.companyId,'UPDATE','RECOMMENDATION',value.id,{status:value.status}); }
  addProcess(value:AgronomicProcess):void { this.db.prepare('INSERT INTO agronomic_processes VALUES(?,?,?,?,?,?,?,?,?,?)').run(value.id,value.companyId,value.upiId,value.recommendationId??null,value.type,value.title,value.objective,value.priority,value.status,value.openedAt); this.processes.push(value); this.audit(value.companyId,'CREATE','PROCESS',value.id,value); }
  addTask(value:Task):void { this.db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(value.id,value.companyId,value.upiId,value.processId??null,value.title,value.description,value.assignedTo,value.priority,value.dueAt,value.status,value.evidenceRequired?1:0,value.evidenceCount); this.tasks.push(value); this.audit(value.companyId,'CREATE','TASK',value.id,value); }
  updateTask(value:Task):void { this.db.prepare('UPDATE tasks SET status=?,evidence_count=? WHERE id=? AND company_id=?').run(value.status,value.evidenceCount,value.id,value.companyId); const i=this.tasks.findIndex(x=>x.id===value.id); if(i>=0)this.tasks[i]=value; this.audit(value.companyId,'UPDATE','TASK',value.id,{status:value.status,evidenceCount:value.evidenceCount}); }
  addDecisionAnalysis(value:DecisionAnalysis):void { this.db.prepare('INSERT INTO decision_analyses VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(value.id,value.companyId,value.upiId,value.modelCode,value.modelVersion,value.createdAt,value.confidence,JSON.stringify(value.contextStatus),JSON.stringify(value.factors),JSON.stringify(value.missingVariables),JSON.stringify(value.contradictions),JSON.stringify(value.alternatives),value.selectedAction,JSON.stringify(value.rationale),JSON.stringify(value.followUp)); this.decisionAnalyses.push(value); this.audit(value.companyId,'CREATE','DECISION_ANALYSIS',value.id,{upiId:value.upiId,selectedAction:value.selectedAction,confidence:value.confidence,modelVersion:value.modelVersion}); }
  addProtocol(value:ProtocolDefinition):void { this.db.prepare('INSERT INTO protocols VALUES(?,?,?,?,?,?,?,?,?)').run(value.id,value.companyId??null,value.code,value.name,value.processType,value.version,value.objective,value.status,JSON.stringify(value.steps)); this.protocols.push(value); this.audit(value.companyId,'CREATE','PROTOCOL',value.id,{code:value.code,version:value.version}); }
  addProtocolExecution(value:ProtocolExecution):void { this.db.prepare('INSERT INTO protocol_executions VALUES(?,?,?,?,?,?,?,?)').run(value.id,value.companyId,value.processId,value.protocolId,value.protocolVersion,value.status,value.startedAt??null,value.completedAt??null); this.protocolExecutions.push(value); this.audit(value.companyId,'CREATE','PROTOCOL_EXECUTION',value.id,value); }
  updateProtocolExecution(value:ProtocolExecution):void { this.db.prepare('UPDATE protocol_executions SET status=?,started_at=?,completed_at=? WHERE id=? AND company_id=?').run(value.status,value.startedAt??null,value.completedAt??null,value.id,value.companyId); const i=this.protocolExecutions.findIndex(x=>x.id===value.id); if(i>=0)this.protocolExecutions[i]=value; this.audit(value.companyId,'UPDATE','PROTOCOL_EXECUTION',value.id,value); }
  addProtocolStepExecution(value:ProtocolStepExecution):void { this.db.prepare('INSERT INTO protocol_step_executions VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(value.id,value.companyId,value.executionId,value.stepId,value.status,value.startedAt??null,value.completedAt??null,value.executedBy??null,value.evidenceCount,JSON.stringify(value.enteredValues),value.omissionReason??null); this.protocolStepExecutions.push(value); this.audit(value.companyId,'CREATE','PROTOCOL_STEP_EXECUTION',value.id,value); }
  updateProtocolStepExecution(value:ProtocolStepExecution):void { this.db.prepare('UPDATE protocol_step_executions SET status=?,started_at=?,completed_at=?,executed_by=?,evidence_count=?,entered_values_json=?,omission_reason=? WHERE id=? AND company_id=?').run(value.status,value.startedAt??null,value.completedAt??null,value.executedBy??null,value.evidenceCount,JSON.stringify(value.enteredValues),value.omissionReason??null,value.id,value.companyId); const i=this.protocolStepExecutions.findIndex(x=>x.id===value.id); if(i>=0)this.protocolStepExecutions[i]=value; this.audit(value.companyId,'UPDATE','PROTOCOL_STEP_EXECUTION',value.id,value); }
  updateProcess(value:AgronomicProcess):void { this.db.prepare('UPDATE agronomic_processes SET status=? WHERE id=? AND company_id=?').run(value.status,value.id,value.companyId); const i=this.processes.findIndex(x=>x.id===value.id); if(i>=0)this.processes[i]=value; this.audit(value.companyId,'UPDATE','PROCESS',value.id,{status:value.status}); }
  addProcessOutcome(value:ProcessOutcome):void { this.db.prepare('INSERT INTO process_outcomes VALUES(?,?,?,?,?,?,?,?,?,?)').run(value.id,value.companyId,value.processId,JSON.stringify(value.expectedIndicators),JSON.stringify(value.observedIndicators),value.status,value.confidence,JSON.stringify(value.modelError),value.evaluatedAt,value.evaluatedBy); this.processOutcomes.push(value); this.audit(value.companyId,'CREATE','PROCESS_OUTCOME',value.id,value); }
  addProcessFollowUp(value:ProcessFollowUp):void { this.db.prepare('INSERT INTO process_follow_ups VALUES(?,?,?,?,?,?,?,?)').run(value.id,value.companyId,value.processId,value.dueAt,JSON.stringify(value.variables),value.status,value.createdAt,value.completedAt??null); this.processFollowUps.push(value); this.audit(value.companyId,'CREATE','PROCESS_FOLLOW_UP',value.id,value); }
  updateProcessFollowUp(value:ProcessFollowUp):void { this.db.prepare('UPDATE process_follow_ups SET status=?,completed_at=? WHERE id=? AND company_id=?').run(value.status,value.completedAt??null,value.id,value.companyId); const i=this.processFollowUps.findIndex(x=>x.id===value.id); if(i>=0)this.processFollowUps[i]=value; this.audit(value.companyId,'UPDATE','PROCESS_FOLLOW_UP',value.id,value); }
  addEvidence(value:Evidence):void { this.db.prepare('INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(value.id,value.companyId,value.upiId,value.processId??null,value.taskId??null,value.observationId??null,value.evidenceType,value.originalFilename,value.mimeType,value.fileSizeBytes,value.checksumSha256,value.storagePath,value.capturedAt,value.uploadedAt,value.uploadedBy,value.description??null,value.phase??null); this.evidence.push(value); this.audit(value.companyId,'CREATE','EVIDENCE',value.id,{upiId:value.upiId,processId:value.processId,taskId:value.taskId,checksum:value.checksumSha256,phase:value.phase}); }


  listAudit(companyId:string):unknown[] {
    return this.db.prepare('SELECT * FROM audit_logs WHERE company_id = ? ORDER BY occurred_at DESC LIMIT 200').all(companyId);
  }

  onApplicationShutdown(): void { this.close(); }
  close():void { this.db.close(); }
}
