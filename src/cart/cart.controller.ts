import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('cart')
@ApiBearerAuth()
@Controller('cart/items')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current cart' })
  getCart(@CurrentUser() user: AuthenticatedUser) {
    return this.cartService.getCart(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a product to the cart (merges quantities)' })
  addItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Set the quantity of a cart item' })
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(user.id, itemId, dto.quantity);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a cart item' })
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) itemId: string,
  ) {
    return this.cartService.removeItem(user.id, itemId);
  }
}
