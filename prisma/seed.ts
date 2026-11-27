import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

const categories = [
  { name: 'إلكترونيات', slug: 'electronics' },
  { name: 'المنزل والمطبخ', slug: 'home-kitchen' },
];

const products = [
  {
    name: 'سماعات لاسلكية بعزل الضوضاء',
    slug: 'wireless-noise-cancelling-headphones',
    description: 'سماعات بلوتوث 5.3 بعزل ضوضاء نشط وبطارية تدوم 30 ساعة.',
    price: 49900,
    stock: 18,
    category: 'electronics',
    image: 'https://images.example.com/headphones.jpg',
  },
  {
    name: 'ساعة ذكية رياضية',
    slug: 'sport-smart-watch',
    description: 'ساعة ذكية مقاومة للماء مع تتبع النشاط والنوم ومعدل النبض.',
    price: 89900,
    stock: 9,
    category: 'electronics',
    image: 'https://images.example.com/smart-watch.jpg',
  },
  {
    name: 'شاحن سريع 65 واط',
    slug: 'gan-charger-65w',
    description: 'شاحن GaN بثلاثة منافذ، يشحن الحاسب والهاتف في آن واحد.',
    price: 19900,
    stock: 40,
    category: 'electronics',
    image: 'https://images.example.com/charger.jpg',
  },
  {
    name: 'لوحة مفاتيح ميكانيكية',
    slug: 'mechanical-keyboard',
    description: 'لوحة مفاتيح 75% بمفاتيح قابلة للتبديل وإضاءة خلفية.',
    price: 34900,
    stock: 12,
    category: 'electronics',
    image: 'https://images.example.com/keyboard.jpg',
  },
  {
    name: 'آلة قهوة إسبريسو',
    slug: 'espresso-machine',
    description: 'آلة قهوة منزلية بضغط 15 بار مع منفاخ حليب.',
    price: 129900,
    stock: 6,
    category: 'home-kitchen',
    image: 'https://images.example.com/espresso.jpg',
  },
  {
    name: 'طقم قدور ستانلس ستيل',
    slug: 'stainless-cookware-set',
    description: 'طقم من 10 قطع ستانلس ستيل مناسب لجميع أنواع المواقد.',
    price: 74900,
    stock: 14,
    category: 'home-kitchen',
    image: 'https://images.example.com/cookware.jpg',
  },
  {
    name: 'خلاط محمول',
    slug: 'portable-blender',
    description: 'خلاط لاسلكي صغير للعصائر، يشحن عبر USB-C.',
    price: 15900,
    stock: 30,
    category: 'home-kitchen',
    image: 'https://images.example.com/blender.jpg',
  },
  {
    name: 'مصباح مكتب LED قابل للتعديل',
    slug: 'adjustable-led-desk-lamp',
    description: 'مصباح مكتب بثلاث درجات إضاءة وذراع قابل للتعديل.',
    price: 12900,
    stock: 25,
    category: 'home-kitchen',
    image: 'https://images.example.com/lamp.jpg',
  },
];

async function main() {
  const categoryBySlug = new Map<string, string>();
  for (const category of categories) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
    categoryBySlug.set(row.slug, row.id);
  }

  for (const product of products) {
    const categoryId = categoryBySlug.get(product.category);
    if (!categoryId) {
      throw new Error(`Unknown category ${product.category}`);
    }
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        categoryId,
      },
      create: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        stock: product.stock,
        categoryId,
        images: { create: [{ url: product.image, alt: product.name, position: 0 }] },
      },
    });
  }

  const users = [
    {
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@store.test',
      password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!',
      name: 'مدير المتجر',
      role: Role.ADMIN,
    },
    {
      email: process.env.SEED_CUSTOMER_EMAIL ?? 'customer@store.test',
      password: process.env.SEED_CUSTOMER_PASSWORD ?? 'Customer123!',
      name: 'سارة العتيبي',
      role: Role.CUSTOMER,
    },
  ];

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
      },
    });
  }

  const counts = {
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    users: await prisma.user.count(),
  };
  process.stdout.write(`Seed complete: ${JSON.stringify(counts)}\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
