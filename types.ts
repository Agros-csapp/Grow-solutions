export type Role = 'ADMIN' | 'TECHNICAL_DIRECTOR' | 'AGRONOMIST' | 'SUPERVISOR' | 'OPERATOR';
export interface AuthUser { id: string; companyId: string; email: string; roles: Role[]; }
export interface Company { id: string; legalName: string; taxIdentifier: string; countryCode: string; }
export interface Farm { id: string; companyId: string; code: string; name: string; totalAreaHa: number; }
export interface Block { id: string; companyId: string; farmId: string; code: string; name: string; areaHa: number; }
export interface Upi { id: string; companyId: string; blockId: string; code: string; name: string; areaM2: number; crop: string; variety: string; fieldCapacity?: number; wiltingPoint?: number; status: 'ACTIVE'|'RISK'|'CRITICAL'; }
export interface Observation { id: string; companyId: string; upiId: string; category: string; severity: string; description: string; observedAt: string; }
export interface Reading { id: string; companyId: string; upiId: string; variableCode: string; value: number; unit: string; measuredAt: string; confidence: number; }
export interface Irrigation { id: string; companyId: string; upiId: string; startAt: string; endAt: string; flowRateM3h: number; appliedVolumeL: number; grossDepthMm: number; }
export type AlertSeverity = 'INFORMATIONAL'|'PREVENTIVE'|'MEDIUM'|'HIGH'|'CRITICAL';
export type AlertStatus = 'OPEN'|'ACKNOWLEDGED'|'RESOLVED';
export interface Alert { id:string; companyId:string; upiId:string; type:string; severity:AlertSeverity; priorityScore:number; title:string; description:string; sourceType:string; sourceId:string; status:AlertStatus; detectedAt:string; }
export type RecommendationStatus = 'DRAFT'|'EMITTED'|'APPROVED'|'REJECTED'|'IN_EXECUTION'|'VERIFIED'|'CLOSED';
export interface Recommendation { id:string; companyId:string; upiId:string; actionCode:string; actionDescription:string; priority:'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'; confidence:number; rationale:string[]; alternatives:string[]; status:RecommendationStatus; createdAt:string; validUntil:string; }
export type ProcessStatus = 'PLANNED'|'APPROVED'|'IN_PROGRESS'|'FOLLOW_UP'|'COMPLETED'|'SUSPENDED'|'CANCELLED';
export interface AgronomicProcess { id:string; companyId:string; upiId:string; recommendationId?:string; type:string; title:string; objective:string; priority:'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'; status:ProcessStatus; openedAt:string; }
export type TaskStatus = 'PENDING'|'ASSIGNED'|'IN_PROGRESS'|'BLOCKED'|'COMPLETED'|'VERIFIED'|'OVERDUE';
export interface Task { id:string; companyId:string; upiId:string; processId?:string; title:string; description:string; assignedTo:string; priority:'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'; dueAt:string; status:TaskStatus; evidenceRequired:boolean; evidenceCount:number; }

export interface DecisionFactor { code:string; label:string; value:number; unit:string; confidence:number; interpretation:string; weight:number; readingId:string; }
export interface DecisionAlternative { code:string; label:string; score:number; benefits:string[]; risks:string[]; selected:boolean; }
export interface DecisionAnalysis {
  id:string; companyId:string; upiId:string; modelCode:string; modelVersion:string; createdAt:string; confidence:number;
  contextStatus:{ moisture:string; ec:string; drainage:string; rootRisk:string; };
  factors:DecisionFactor[]; missingVariables:string[]; contradictions:string[]; alternatives:DecisionAlternative[];
  selectedAction:string; rationale:string[];
  followUp:{ verifyInHours:number; variables:string[]; anticipateNextDayIrrigation:string; note?:string; };
}


export type ProtocolStatus = 'DRAFT'|'ACTIVE'|'RETIRED';
export type ProtocolStepStatus = 'PENDING'|'AVAILABLE'|'IN_PROGRESS'|'COMPLETED'|'REJECTED'|'SKIPPED';
export interface ProtocolStepDefinition {
  id:string; stepNumber:number; title:string; instruction:string; isCritical:boolean; evidenceRequired:boolean; requiredVariables:string[]; acceptanceCriteria:Record<string,unknown>;
}
export interface ProtocolDefinition {
  id:string; companyId?:string; code:string; name:string; processType:string; version:number; objective:string; status:ProtocolStatus; steps:ProtocolStepDefinition[];
}
export interface ProtocolExecution {
  id:string; companyId:string; processId:string; protocolId:string; protocolVersion:number; status:'PLANNED'|'IN_PROGRESS'|'FOLLOW_UP'|'COMPLETED'|'SUSPENDED'; startedAt?:string; completedAt?:string;
}
export interface ProtocolStepExecution {
  id:string; companyId:string; executionId:string; stepId:string; status:ProtocolStepStatus; startedAt?:string; completedAt?:string; executedBy?:string; evidenceCount:number; enteredValues:Record<string,number|string|boolean>; omissionReason?:string;
}
export type OutcomeStatus = 'SUCCESS'|'PARTIAL'|'NO_CHANGE'|'ADVERSE'|'NOT_VERIFIABLE';
export interface ProcessOutcome {
  id:string; companyId:string; processId:string; expectedIndicators:Record<string,number>; observedIndicators:Record<string,number>; status:OutcomeStatus; confidence:number; modelError:Record<string,number>; evaluatedAt:string; evaluatedBy:string;
}
export interface ProcessFollowUp {
  id:string; companyId:string; processId:string; dueAt:string; variables:string[]; status:'PENDING'|'DUE'|'COMPLETED'|'CANCELLED'; createdAt:string; completedAt?:string;
}

export type EvidenceType = 'PHOTO'|'VIDEO'|'DOCUMENT'|'READING'|'SIGNATURE';
export interface Evidence {
  id:string; companyId:string; upiId:string; processId?:string; taskId?:string; observationId?:string;
  evidenceType:EvidenceType; originalFilename:string; mimeType:string; fileSizeBytes:number; checksumSha256:string;
  storagePath:string; capturedAt:string; uploadedAt:string; uploadedBy:string; description?:string; phase?:'BEFORE'|'DURING'|'AFTER';
}
export type TimelineEventType = 'OBSERVATION'|'READING'|'IRRIGATION'|'ALERT'|'RECOMMENDATION'|'PROCESS'|'TASK'|'EVIDENCE'|'PROTOCOL'|'FOLLOW_UP'|'OUTCOME';
export interface TimelineEvent { id:string; upiId:string; type:TimelineEventType; occurredAt:string; title:string; summary:string; severity?:string; sourceId:string; relatedIds:Record<string,string|undefined>; }
