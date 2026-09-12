import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';
import { AwsSmsService } from './aws-sms.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'change-me',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || process.env.JWT_EXPIRES_IN || '7d',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, FirebaseService, AwsSmsService, JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule { }

