import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('healthz')
  @ApiOperation({ summary: 'Liveness probe' })
  liveness() {
    return this.healthService.liveness();
  }

  @Get('readyz')
  @ApiOperation({ summary: 'Readiness probe (checks PostgreSQL and Redis)' })
  readiness() {
    return this.healthService.readiness();
  }
}
