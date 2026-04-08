// packages/shared-types/src/dto/patrols/create-patrol.dto.ts
import { IsDateString, IsUUID } from 'class-validator';

export class CreatePatrolDto {
  @IsUUID()
  unitId!: string;

  @IsUUID()
  sectorId!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;
}
