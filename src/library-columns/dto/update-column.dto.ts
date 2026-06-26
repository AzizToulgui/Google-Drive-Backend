import { IsString, IsIn, IsOptional, IsArray, MaxLength, IsInt, Min } from 'class-validator';

export class UpdateColumnDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn(['text', 'integer', 'float', 'enum'])
  type?: 'text' | 'integer' | 'float' | 'enum';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enumOptions?: string[];

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
