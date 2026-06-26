import { IsArray, ValidateNested, IsUUID, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ColumnValueEntry {
  @IsUUID()
  columnId: string;

  @IsOptional()
  @IsString()
  value: string | null;
}

export class SetColumnValuesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnValueEntry)
  values: ColumnValueEntry[];
}
