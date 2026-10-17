import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StatisticsController } from './statistics.controller.js';
import { StatisticsService } from './statistics.service.js';
import { BotUsersService } from './bot-users.service.js';

@Module({
  imports: [AuthModule],
  controllers: [StatisticsController],
  providers: [StatisticsService, BotUsersService],
})
export class StatisticsModule {}
