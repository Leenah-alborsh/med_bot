import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RequestLoggingMiddleware } from './common/request-logging.middleware.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AdminsModule } from './admins/admins.module.js';
import { StatisticsModule } from './statistics/statistics.module.js';
import { BootstrapModule } from './bootstrap/bootstrap.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { ContentModule } from './content/content.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { AuditController } from './audit/audit.controller.js';

@Module({
  controllers: [AuditController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '../../.env.example'],
      validate: validateEnvironment,
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    AdminsModule,
    StatisticsModule,
    BootstrapModule,
    CatalogModule,
    ContentModule,
    ReportsModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
