import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { VerifyFirebaseTokenDto } from './dto/verify-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Send OTP SMS via AWS SNS
   */
  @Post('send-otp')
  async sendOtp(@Body('phone') phone: string) {
    return this.authService.sendOtp(phone);
  }

  /**
   * Verify OTP SMS and Login/Register
   */
  @Post('verify-otp')
  async verifyOtp(@Body('phone') phone: string, @Body('code') code: string) {
    return this.authService.verifyOtp(phone, code);
  }

  /**
   * Backwards-compatible aliases
   */
  @Post('send-whatsapp-otp')
  async sendWhatsappOtp(@Body('phone') phone: string) {
    return this.authService.sendOtp(phone);
  }

  @Post('verify-whatsapp-otp')
  async verifyWhatsappOtp(@Body('phone') phone: string, @Body('code') code: string) {
    return this.authService.verifyOtp(phone, code);
  }

  @Post('verify')
  async verify(@Body() dto: VerifyFirebaseTokenDto) {
    return this.authService.loginWithFirebaseToken(dto.idToken);
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }
}
