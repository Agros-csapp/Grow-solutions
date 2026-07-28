import { Test } from '@nestjs/testing';
import { CommonModule } from './common/common.module';
import { Store } from './common/store';
import { AlertsService } from './alerts/alerts.service';
import { ProcessesService } from './processes/processes.service';
import { TasksService } from './tasks/tasks.service';
import { RecommendationsService } from './recommendations/recommendations.service';
import { newId } from './common/id';
import { DecisionEngineService } from './decision-engine/decision-engine.service';

describe('intelligence flow',()=>{
  let store:Store,alerts:AlertsService,recs:RecommendationsService;
  beforeEach(async()=>{process.env.NODE_ENV='test';const m=await Test.createTestingModule({imports:[CommonModule],providers:[AlertsService,ProcessesService,TasksService,DecisionEngineService,RecommendationsService]}).compile();store=m.get(Store);alerts=m.get(AlertsService);recs=m.get(RecommendationsService);const companyId='c1';store.addCompany({id:companyId,legalName:'Test',taxIdentifier:newId(),countryCode:'CO'});store.addUser({id:'u1',companyId,email:'a@a.com',roles:['ADMIN'],passwordHash:'x'});store.addFarm({id:'f1',companyId,code:'F1',name:'Farm',totalAreaHa:1});store.addBlock({id:'b1',companyId,farmId:'f1',code:'B1',name:'Block',areaHa:1});store.addUpi({id:'upi1',companyId,blockId:'b1',code:'U1',name:'UPI',areaM2:1000,crop:'Rose',variety:'Freedom',status:'ACTIVE'});});
  afterEach(()=>store.close());
  it('prevents duplicate active alert',()=>{alerts.create('c1',{upiId:'upi1',type:'EC_HIGH',severity:'HIGH',title:'CE alta',description:'CE elevada',sourceType:'READING',sourceId:'r1'});expect(()=>alerts.create('c1',{upiId:'upi1',type:'EC_HIGH',severity:'HIGH',title:'CE alta',description:'CE elevada',sourceType:'READING',sourceId:'r1'})).toThrow();});
  it('generates, explains and approves recommendation creating process and task',()=>{store.addReading({id:'m1',companyId:'c1',upiId:'upi1',variableCode:'SOIL_MOISTURE',value:30,unit:'PERCENT',measuredAt:new Date().toISOString(),confidence:90});store.addReading({id:'r1',companyId:'c1',upiId:'upi1',variableCode:'EC',value:3.2,unit:'DS_M',measuredAt:new Date().toISOString(),confidence:90});store.addReading({id:'d1',companyId:'c1',upiId:'upi1',variableCode:'DRAINAGE_PERCENT',value:25,unit:'PERCENT',measuredAt:new Date().toISOString(),confidence:90});store.addReading({id:'rr1',companyId:'c1',upiId:'upi1',variableCode:'ROOT_RISK',value:20,unit:'INDEX',measuredAt:new Date().toISOString(),confidence:90});store.addReading({id:'wa1',companyId:'c1',upiId:'upi1',variableCode:'WATER_AVAILABILITY',value:1,unit:'BOOLEAN',measuredAt:new Date().toISOString(),confidence:90});alerts.create('c1',{upiId:'upi1',type:'EC_HIGH',severity:'HIGH',title:'CE alta',description:'CE elevada',sourceType:'READING',sourceId:'r1'});const r=recs.generate('c1',{upiId:'upi1'});expect(r.actionCode).toBe('PERFORM_LEACHING');expect(recs.explain('c1',r.id).evidence.length).toBeGreaterThan(0);const approved=recs.approve('c1',r.id,{assignedTo:'u1'});expect(approved.process.recommendationId).toBe(r.id);expect(approved.task.evidenceRequired).toBe(true);});
});
