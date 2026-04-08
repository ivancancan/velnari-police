import { IsString, IsOptional, IsBoolean, MinLength, MaxLength, Matches, IsArray, ArrayMinSize } from 'class-validator';

export class CreateSectorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, { message: 'color must be a valid hex color' })
  color?: string;
}

export class UpdateSectorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, { message: 'color must be a valid hex color' })
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetBoundaryDto {
  @IsArray()
  @ArrayMinSize(4)
  coordinates!: [number, number][];
}
