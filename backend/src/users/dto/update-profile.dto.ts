import { IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsDateString() dob?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsArray() interestedIn?: string[];
  @IsOptional() @IsInt() @Min(18) minAge?: number;
  @IsOptional() @IsInt() @Max(99) maxAge?: number;
  @IsOptional() @IsInt() maxDistanceKm?: number;
  @IsOptional() latitude?: number;
  @IsOptional() longitude?: number;
  @IsOptional() @IsBoolean() incognitoMode?: boolean;
  @IsOptional() @IsBoolean() isIncognito?: boolean;
  @IsOptional() @IsBoolean() passportActive?: boolean;
  @IsOptional() passportLat?: number;
  @IsOptional() passportLng?: number;
  @IsOptional() @IsString() passportCity?: string;
  @IsOptional() @IsString() voiceBioUrl?: string;
  @IsOptional() twoTruths?: any;
  @IsOptional() @IsArray() interests?: string[];
}

