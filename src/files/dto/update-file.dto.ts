import { IsString, MaxLength } from 'class-validator';

export class UpdateFileDto {
  @IsString()
  @MaxLength(255)
  name: string;
}
