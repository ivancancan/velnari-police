import { IsUUID } from 'class-validator';

export class AssignUnitDto {
  @IsUUID()
  unitId!: string;
}
