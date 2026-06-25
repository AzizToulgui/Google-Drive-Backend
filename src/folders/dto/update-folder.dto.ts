import { IsString, MaxLength } from 'class-validator';

export class UpdateFolderDto {
  @IsString()
  @MaxLength(255)
  name: string;
}
