import { IsIn } from 'class-validator';

export class SetVisibilityDto {
  @IsIn(['public', 'private'])
  visibility: 'public' | 'private';
}
