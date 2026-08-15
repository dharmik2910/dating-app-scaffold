import { IsArray, IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateProfileDto {
  @IsString() name!: string;
  @IsDateString() dob!: string;
  @IsString() gender!: string;
  @IsOptional() @IsString() bio?: string;
  @IsArray() interestedIn!: string[];
  @IsOptional() @IsInt() @Min(18) minAge?: number;
  @IsOptional() @IsInt() @Max(99) maxAge?: number;
  @IsOptional() @IsInt() maxDistanceKm?: number;
  @IsOptional() latitude?: number;
  @IsOptional() longitude?: number;
}
