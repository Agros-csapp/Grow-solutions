import { Test } from '@nestjs/testing';
import { CommonModule } from './common/common.module';
import { Store } from './common/store';
import { newId } from './common/id';
import { ProcessesService } from './processes/processes.service';
import { ProtocolsService } from './protocols/protocols.service';

describe('protocol execution and technical closure',()=>{
  let store:Store,processes:ProcessesService,protocols:ProtocolsService;
  beforeEach(async()=>{
    process.env.NODE_ENV='test';delete process.env.AGROS_DB_PATH;
    const module=await Test.createTestingModule({imports:[CommonModule],providers:[ProcessesService,ProtocolsService]}).compile();
    store=module.get(Store);processes=module.get(ProcessesService);protocols=module.get(ProtocolsService);protocols.onModuleInit();
    store.addCompany({id:'c1',legalName:'Test',taxIdentifier:newId(),countryCode:'CO'});
    store.addUser({id:'u1',companyId:'c1',email:'a@a.com',roles:['ADMIN'],passwordHash:'x'});
    store.addFarm({id:'f1',companyId:'c1',code:'F1',name:'Farm',totalAreaHa:1});
    store.addBlock({id:'b1',companyId:'c1',farmId:'f1',code:'B1',name:'Block',areaHa:1});
    store.addUpi({id:'upi1',companyId:'c1',blockId:'b1',code:'U1',name:'UPI',areaM2:1000,crop:'Rose',variety:'Freedom',status:'ACTIVE'});
  });
  afterEach(()=>store.close());

  it('executes protocol in order, schedules follow-up and closes technically',()=>{
    const process=processes.create('c1',{upiId:'upi1',type:'PERFORM_LEACHING',title:'Lavado',objective:'Reducir CE',priority:'HIGH'});
    const started=protocols.start('c1',process.id);
    const definitions=started.protocol.steps.sort((a,b)=>a.stepNumber-b.stepNumber);
    expect(()=>protocols.executeStep('c1',process.id,definitions[0].id,{executedBy:'u1',evidenceCount:0,enteredValues:{SOIL_MOISTURE:30,DRAINAGE_PERCENT:25,ROOT_RISK:20}})).toThrow('requiere evidencia');
    protocols.executeStep('c1',process.id,definitions[0].id,{executedBy:'u1',evidenceCount:1,enteredValues:{SOIL_MOISTURE:30,DRAINAGE_PERCENT:25,ROOT_RISK:20}});
    protocols.executeStep('c1',process.id,definitions[1].id,{executedBy:'u1',evidenceCount:0,enteredValues:{LEACHING_DEPTH_MM:10}});
    protocols.executeStep('c1',process.id,definitions[2].id,{executedBy:'u1',evidenceCount:1,enteredValues:{APPLIED_DEPTH_MM:10}});
    protocols.executeStep('c1',process.id,definitions[3].id,{executedBy:'u1',evidenceCount:1,enteredValues:{DRAINAGE_PERCENT:27}});
    protocols.executeStep('c1',process.id,definitions[4].id,{executedBy:'u1',evidenceCount:0,enteredValues:{}});
    const followUp=store.processFollowUps.find((f)=>f.processId===process.id)!;
    expect(followUp.variables).toContain('EC');
    const outcome=processes.evaluate('c1',process.id,{confidence:92,evaluatedBy:'u1',metrics:[
      {code:'EC',expected:2.5,observed:2.4,tolerance:0.2,objective:'MIN'},
      {code:'SOIL_MOISTURE',expected:35,observed:36,tolerance:3,objective:'TARGET'},
      {code:'ROOT_RISK',expected:30,observed:25,tolerance:5,objective:'MIN'},
    ]});
    expect(outcome.status).toBe('SUCCESS');
    expect(()=>processes.close('c1',process.id)).toThrow('seguimientos pendientes');
    processes.completeFollowUp('c1',process.id,followUp.id);
    expect(processes.close('c1',process.id).status).toBe('COMPLETED');
  });

  it('blocks technical closure after adverse outcome',()=>{
    const process=processes.create('c1',{upiId:'upi1',type:'REQUEST_MEASUREMENT',title:'Medir',objective:'Mejorar evidencia',priority:'MEDIUM'});
    const started=protocols.start('c1',process.id);
    for(const definition of started.protocol.steps.sort((a,b)=>a.stepNumber-b.stepNumber)){
      protocols.executeStep('c1',process.id,definition.id,{executedBy:'u1',evidenceCount:definition.evidenceRequired?1:0,enteredValues:{}});
    }
    const outcome=processes.evaluate('c1',process.id,{confidence:90,evaluatedBy:'u1',metrics:[{code:'ROOT_RISK',expected:30,observed:80,tolerance:5,objective:'MIN'}]});
    expect(outcome.status).toBe('ADVERSE');
    expect(()=>processes.close('c1',process.id)).toThrow('no permite cierre técnico');
  });

  it('does not allow critical step omission',()=>{
    const process=processes.create('c1',{upiId:'upi1',type:'IRRIGATE',title:'Riego',objective:'Corregir déficit',priority:'HIGH'});
    const started=protocols.start('c1',process.id);
    expect(()=>protocols.skipStep('c1',process.id,started.protocol.steps[0].id,{executedBy:'u1',reason:'No disponible'})).toThrow('crítico');
  });
});
