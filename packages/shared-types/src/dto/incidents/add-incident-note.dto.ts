import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddIncidentNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text!: string;
}
