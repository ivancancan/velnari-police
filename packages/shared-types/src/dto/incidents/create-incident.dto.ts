import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IncidentPriority } from '../../enums/incident-priority.enum';
import { IncidentType } from '../../enums/incident-type.enum';

export class CreateIncidentDto {
  @IsEnum(IncidentType)
  type!: IncidentType;

  @IsEnum(IncidentPriority)
  priority!: IncidentPriority;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUUID()
  sectorId?: string;
}
