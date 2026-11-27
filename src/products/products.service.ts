import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception';
import { buildPage, cursorFilter, decodeCursor, PageInfo } from '../common/pagination/cursor';
import { PrismaService } from '../common/prisma/prisma.service';
import { slugOrFallback } from '../common/utils/slug';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { productDetailInclude, toProductDto } from './product.mapper';

export interface ProductPage {
  data: ReturnType<typeof toProductDto>[];
  pageInfo: PageInfo;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListProductsQueryDto): Promise<ProductPage> {
    const limit = query.limit ?? 20;
    const where: Prisma.ProductWhereInput = { isActive: true };
    const and: Prisma.ProductWhereInput[] = [];

    if (query.q) {
      const term = query.q.trim();
      if (term) {
        and.push({
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        });
      }
    }
    if (query.categoryId) {
      and.push({ categoryId: query.categoryId });
    }
    if (query.categorySlug) {
      and.push({ category: { slug: query.categorySlug } });
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      and.push({
        price: {
          gte: query.minPrice,
          lte: query.maxPrice,
        },
      });
    }
    if (and.length > 0) {
      where.AND = and;
    }
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      where.AND = [...(and as Prisma.ProductWhereInput[]), cursorFilter(cursor)];
    }

    const rows = await this.prisma.product.findMany({
      where,
      include: productDetailInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const { items, pageInfo } = buildPage(rows, limit);
    return { data: items.map(toProductDto), pageInfo };
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true },
      include: productDetailInclude,
    });
    if (!product) {
      throw AppException.notFound('PRODUCT_NOT_FOUND', 'Product not found');
    }
    return toProductDto(product);
  }

  async create(dto: CreateProductDto): Promise<ReturnType<typeof toProductDto>> {
    await this.assertCategory(dto.categoryId);

    const slug = dto.slug ? slugOrFallback(dto.slug, 'product') : slugOrFallback(dto.name, 'product');
    const clash = await this.prisma.product.findUnique({ where: { slug } });
    if (clash) {
      throw AppException.conflict('PRODUCT_SLUG_TAKEN', 'A product with this slug already exists');
    }

    const product = await this.prisma.product.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim(),
        price: dto.price,
        stock: dto.stock,
        categoryId: dto.categoryId,
        isActive: dto.isActive ?? true,
        currency: dto.currency ?? 'SAR',
        images: dto.images?.length
          ? {
              create: dto.images.map((image, index) => ({
                url: image.url,
                alt: image.alt,
                position: image.position ?? index,
              })),
            }
          : undefined,
      },
      include: productDetailInclude,
    });

    return toProductDto(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ReturnType<typeof toProductDto>> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw AppException.notFound('PRODUCT_NOT_FOUND', 'Product not found');
    }
    if (dto.categoryId) {
      await this.assertCategory(dto.categoryId);
    }

    let slug: string | undefined;
    if (dto.slug) {
      slug = slugOrFallback(dto.slug, 'product');
      if (slug !== existing.slug) {
        const clash = await this.prisma.product.findUnique({ where: { slug } });
        if (clash) {
          throw AppException.conflict('PRODUCT_SLUG_TAKEN', 'A product with this slug already exists');
        }
      }
    }

    const stockChanged = dto.stock !== undefined && dto.stock !== existing.stock;

    const product = await this.prisma.$transaction(async (tx) => {
      if (dto.images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
      }
      return tx.product.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          slug,
          description: dto.description?.trim(),
          price: dto.price,
          stock: dto.stock,
          categoryId: dto.categoryId,
          isActive: dto.isActive,
          currency: dto.currency,
          version: stockChanged ? { increment: 1 } : undefined,
          images: dto.images
            ? {
                create: dto.images.map((image, index) => ({
                  url: image.url,
                  alt: image.alt,
                  position: image.position ?? index,
                })),
              }
            : undefined,
        },
        include: productDetailInclude,
      });
    });

    return toProductDto(product);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw AppException.notFound('PRODUCT_NOT_FOUND', 'Product not found');
    }
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false, version: { increment: 1 } },
    });
  }

  private async assertCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw AppException.notFound('CATEGORY_NOT_FOUND', 'Category not found');
    }
  }
}
