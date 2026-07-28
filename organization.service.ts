import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { newId } from '../common/id';
import { Store } from '../common/store';
@Injectable()
export class OrganizationService {
 constructor(private readonly store: Store) {}
 createFarm(companyId:string,input:{code:string;name:string;totalAreaHa:number}) { if(input.totalAreaHa<=0) throw new UnprocessableEntityException('Área inválida'); if(this.store.farms.some(f=>f.companyId===companyId&&f.code===input.code)) throw new ConflictException('Código duplicado'); const farm={id:newId(),companyId,...input}; this.store.addFarm(farm); return farm; }
 createBlock(companyId:string,input:{farmId:string;code:string;name:string;areaHa:number}) { const farm=this.store.farms.find(f=>f.id===input.farmId&&f.companyId===companyId); if(!farm) throw new NotFoundException('Finca no encontrada'); if(input.areaHa<=0) throw new UnprocessableEntityException('Área inválida'); if(this.store.blocks.some(b=>b.farmId===input.farmId&&b.code===input.code)) throw new ConflictException('Código duplicado'); const block={id:newId(),companyId,...input}; this.store.addBlock(block); return block; }
 listFarms(companyId:string){return this.store.farms.filter(f=>f.companyId===companyId)}
 listBlocks(companyId:string){return this.store.blocks.filter(b=>b.companyId===companyId)}
}
