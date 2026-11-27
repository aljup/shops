import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create an order (requires Idempotency-Key; stock reserved atomically)' })
  @ApiResponse({ status: 201, description: 'Order created' })
  @ApiResponse({ status: 200, description: 'Replay of an earlier request with the same key' })
  async create(
    @Res({ passthrough: true }) res: Response,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ) {
    const result = await this.ordersService.create(user.id, user.email, idempotencyKey, dto);
    res.status(result.statusCode);
    return result.body;
  }

  @Get()
  @ApiOperation({ summary: 'List the current user orders with cursor pagination' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.list(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the current user orders' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.ordersService.findOne(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a PENDING or PAID order and restore stock' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CancelOrderDto = {},
  ) {
    return this.ordersService.cancel(user.id, id, dto.reason?.trim() || 'customer_cancelled');
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Patch(':id/status')
  @ApiOperation({ summary: 'Move an order through the state machine' })
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.adminUpdateStatus(id, dto);
  }
}
