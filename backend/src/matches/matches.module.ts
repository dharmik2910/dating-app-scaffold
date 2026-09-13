import { Module, forwardRef } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [AuthModule, forwardRef(() => ChatModule)],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
