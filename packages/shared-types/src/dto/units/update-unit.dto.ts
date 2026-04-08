import { IsString, IsOptional, IsUUID, IsEnum, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { UnitStatus } from '../../enums/unit-status.enum';

export class UpdateUnitDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  callSign?: string;

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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
