import { IsString, IsOptional, IsUUID, IsEnum, MinLength, MaxLength } from 'class-validator';
import { UnitStatus } from '../../enums/unit-status.enum';

export class CreateUnitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  callSign!: string;

  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @IsOptional()
  @IsUUID()
  sectorId?: string;

  @IsOptional()
  @IsString()
  shift?: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;
}
