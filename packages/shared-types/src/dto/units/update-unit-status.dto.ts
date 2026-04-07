import { IsEnum } from 'class-validator';
import { UnitStatus } from '../../enums/unit-status.enum';

export class UpdateUnitStatusDto {
  @IsEnum(UnitStatus)
  status!: UnitStatus;
}
