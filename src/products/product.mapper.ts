import { Prisma } from '@prisma/client';

export const productDetailInclude = {
  category: true,
  images: { orderBy: { position: 'asc' } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;

export function toProductDto(product: ProductWithRelations) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    currency: product.currency,
    stock: product.stock,
    isActive: product.isActive,
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    },
    images: product.images.map((image) => ({
      id: image.id,
      url: image.url,
      alt: image.alt,
      position: image.position,
    })),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
