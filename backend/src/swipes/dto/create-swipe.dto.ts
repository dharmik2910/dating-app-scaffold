import { IsEnum, IsUUID } from 'class-validator';

export enum SwipeActionDto {
  LIKE = 'LIKE',
  PASS = 'PASS',
  SUPERLIKE = 'SUPERLIKE',
  UNLIKE = 'UNLIKE',
}

export class CreateSwipeDto {
  @IsUUID() swipedId!: string;
  @IsEnum(SwipeActionDto) action!: SwipeActionDto;
}
