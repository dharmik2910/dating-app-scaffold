import { Module, forwardRef } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [AuthModule, forwardRef(() => ChatModule)],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
})
export class DiscoveryModule {}
