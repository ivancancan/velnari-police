import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportTemplateEntity } from '../../entities/report-template.entity';
import { ReportSubmissionEntity } from '../../entities/report-submission.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ReportTemplateEntity)
    private readonly templateRepo: Repository<ReportTemplateEntity>,
    @InjectRepository(ReportSubmissionEntity)
    private readonly submissionRepo: Repository<ReportSubmissionEntity>,
  ) {}

  findAllTemplates(): Promise<ReportTemplateEntity[]> {
    return this.templateRepo.find({ where: { isActive: true }, order: { createdAt: 'DESC' } });
  }

  async findOneTemplate(id: string): Promise<ReportTemplateEntity> {
    const t = await this.templateRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Template no encontrado');
    return t;
  }

  createTemplate(data: { name: string; description?: string; fields: unknown[] }, createdBy: string): Promise<ReportTemplateEntity> {
    const template = this.templateRepo.create({ ...data, fields: data.fields as any, createdBy });
    return this.templateRepo.save(template);
  }

  async updateTemplate(id: string, data: { name?: string; description?: string; fields?: unknown[] }): Promise<ReportTemplateEntity> {
    const template = await this.findOneTemplate(id);
    if (data.name) template.name = data.name;
    if (data.description !== undefined) template.description = data.description;
    if (data.fields) template.fields = data.fields as any;
    return this.templateRepo.save(template);
  }

  async deleteTemplate(id: string): Promise<void> {
    const template = await this.findOneTemplate(id);
    template.isActive = false;
    await this.templateRepo.save(template);
  }

  // Submissions
  findSubmissions(templateId?: string, incidentId?: string): Promise<ReportSubmissionEntity[]> {
    const where: Record<string, unknown> = {};
    if (templateId) where['templateId'] = templateId;
    if (incidentId) where['incidentId'] = incidentId;
    return this.submissionRepo.find({ where, order: { createdAt: 'DESC' }, relations: ['template', 'submitter'] });
  }

  async createSubmission(data: { templateId: string; incidentId?: string; data: Record<string, unknown> }, submittedBy: string): Promise<ReportSubmissionEntity> {
    await this.findOneTemplate(data.templateId); // validate template exists
    const submission = this.submissionRepo.create({ ...data, submittedBy });
    return this.submissionRepo.save(submission);
  }
}
