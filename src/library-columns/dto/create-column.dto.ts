import { IsString, IsIn, IsOptional, IsArray, MaxLength } from 'class-validator';

export class CreateColumnDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsIn(['text', 'integer', 'float', 'enum'])
  type: 'text' | 'integer' | 'float' | 'enum';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enumOptions?: string[];

  @IsOptional()
  @IsString()
  defaultValue?: string;
}
