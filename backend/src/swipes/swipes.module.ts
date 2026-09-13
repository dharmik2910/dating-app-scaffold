import { Module } from '@nestjs/common';
import { SwipesController } from './swipes.controller';
import { SwipesService } from './swipes.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule],
  controllers: [SwipesController],
  providers: [SwipesService],
  exports: [SwipesService],
})
export class SwipesModule {}

