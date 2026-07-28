import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBase64, IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Response } from 'express';
import { CompanyId } from '../auth/company-id.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser, EvidenceType } from '../common/types';
import { EvidenceService } from './evidence.service';
class EvidenceDto{@IsString()upiId!:string;@IsOptional()@IsString()processId?:string;@IsOptional()@IsString()taskId?:string;@IsOptional()@IsString()observationId?:string;@IsIn(['PHOTO','VIDEO','DOCUMENT','READING','SIGNATURE'])evidenceType!:EvidenceType;@IsString()originalFilename!:string;@IsString()mimeType!:string;@IsBase64()contentBase64!:string;@IsISO8601()capturedAt!:string;@IsOptional()@IsString()description?:string;@IsOptional()@IsIn(['BEFORE','DURING','AFTER'])phase?:'BEFORE'|'DURING'|'AFTER';}
@ApiTags('evidence') @ApiBearerAuth() @Controller('evidence')
export class EvidenceController{constructor(private readonly service:EvidenceService){}@Post()create(@CompanyId()c:string,@CurrentUser()u:AuthUser,@Body()d:EvidenceDto){return this.service.create(c,u.id,d)}@Get()list(@CompanyId()c:string,@Query('upiId')u:string){return this.service.list(c,u)}@Get('compare/:processId')compare(@CompanyId()c:string,@Param('processId')p:string){return this.service.compare(c,p)}@Get(':id/file')file(@CompanyId()c:string,@Param('id')id:string,@Res()res:Response){const{evidence,buffer}=this.service.getFile(c,id);res.type(evidence.mimeType).send(buffer)}}
