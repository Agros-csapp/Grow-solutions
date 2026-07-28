import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Store } from './common/store';

describe('persistent SQLite store',()=>{
  it('survives a complete store restart',()=>{
    const dir=mkdtempSync(join(tmpdir(),'agros-'));
    const path=join(dir,'agros.db');
    process.env.AGROS_DB_PATH=path;
    const first=new Store();
    first.addCompany({id:'11111111-1111-4111-8111-111111111111',legalName:'Persistente SAS',taxIdentifier:'P-1',countryCode:'CO'});
    first.addFarm({id:'22222222-2222-4222-8222-222222222222',companyId:'11111111-1111-4111-8111-111111111111',code:'F1',name:'Finca',totalAreaHa:5});
    first.close();
    const second=new Store();
    expect(second.companies).toHaveLength(1);
    expect(second.farms[0]?.name).toBe('Finca');
    expect(second.listAudit('11111111-1111-4111-8111-111111111111')).toHaveLength(2);
    second.close();
    delete process.env.AGROS_DB_PATH;
    rmSync(dir,{recursive:true,force:true});
  });
});
