import { HttpStatus, Injectable } from '@nestjs/common';
import { Category } from '@prisma/client';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { slugOrFallback } from '../common/utils/slug';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category) {
      throw AppException.notFound('CATEGORY_NOT_FOUND', 'Category not found');
    }
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = dto.slug ? slugOrFallback(dto.slug, 'category') : slugOrFallback(dto.name, 'category');
    const clash = await this.prisma.category.findUnique({ where: { slug } });
    if (clash) {
      throw AppException.conflict('CATEGORY_SLUG_TAKEN', 'A category with this slug already exists');
    }
    return this.prisma.category.create({ data: { name: dto.name.trim(), slug } });
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw AppException.notFound('CATEGORY_NOT_FOUND', 'Category not found');
    }

    const slug = dto.slug ? slugOrFallback(dto.slug, 'category') : undefined;
    if (slug && slug !== category.slug) {
      const clash = await this.prisma.category.findUnique({ where: { slug } });
      if (clash) {
        throw AppException.conflict('CATEGORY_SLUG_TAKEN', 'A category with this slug already exists');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name?.trim(), slug },
    });
  }

  async remove(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) {
      throw AppException.notFound('CATEGORY_NOT_FOUND', 'Category not found');
    }
    if (category._count.products > 0) {
      throw new AppException(
        'CATEGORY_NOT_EMPTY',
        'Move or delete the products of this category first',
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.category.delete({ where: { id } });
  }
}
