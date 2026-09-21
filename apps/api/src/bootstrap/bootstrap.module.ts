import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BootstrapService } from './bootstrap.service.js';

@Module({ imports: [AuthModule], providers: [BootstrapService], exports: [BootstrapService] })
export class BootstrapModule {}
