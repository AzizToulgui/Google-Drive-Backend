import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
