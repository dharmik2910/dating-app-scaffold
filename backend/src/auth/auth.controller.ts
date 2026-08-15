import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { VerifyFirebaseTokenDto } from './dto/verify-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Client signs in with Firebase Phone Auth (sends its own OTP SMS),
  // then sends us the resulting Firebase ID token to exchange for our app JWTs.
  @Post('verify')
  async verify(@Body() dto: VerifyFirebaseTokenDto) {
    return this.authService.loginWithFirebaseToken(dto.idToken);
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }
}
