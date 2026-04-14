import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IncidentPriority } from '../../enums/incident-priority.enum';
import { IncidentType } from '../../enums/incident-type.enum';

export class UpdateIncidentDto {
  @IsOptional()
  @IsEnum(IncidentType)
  type?: IncidentType;

  @IsOptional()
  @IsEnum(IncidentPriority)
  priority?: IncidentPriority;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CloseIncidentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  resolution!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
