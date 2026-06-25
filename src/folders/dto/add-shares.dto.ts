import { IsArray, IsUUID } from 'class-validator';

export class AddSharesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];
}
