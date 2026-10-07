import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './cache/redis.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
  ],
  exports: [
    DatabaseModule,
    RedisModule,
  ],
})
export class InfrastructureModule {}
