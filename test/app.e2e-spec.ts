import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
});

describe('Store API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  const customer = {
    email: `customer-${randomUUID()}@example.com`,
    password: 'Str0ngPass!',
    name: 'عميل اختبار',
  };
  const admin = {
    email: `admin-${randomUUID()}@example.com`,
    password: 'Str0ngPass!',
    name: 'مدير اختبار',
  };

  let category: { id: string };
  let product: { id: string; slug: string; stock: number };
  let customerAccess: string;
  let adminAccess: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('health is public', async () => {
    const res = await http.get('/api/v1/healthz');
    expect(res.status).toBe(200);
  });

  it('rejects invalid registration with the unified error shape', async () => {
    const res = await http.post('/api/v1/auth/register').send({ email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(res.body.error.requestId).toBeDefined();
  });

  it('registers a customer and logs in', async () => {
    const res = await http.post('/api/v1/auth/register').send(customer);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(customer.email);
    expect(res.body.user.role).toBe('CUSTOMER');
    expect(res.body.accessToken).toBeDefined();

    const login = await http
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: customer.password });
    expect(login.status).toBe(200);
    customerAccess = login.body.accessToken;

    const bad = await http
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: 'WrongPass!1' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('requires auth for protected routes', async () => {
    const res = await http.get('/api/v1/cart/items');
    expect(res.status).toBe(401);
  });

  it('lists products with pagination envelope', async () => {
    const res = await http.get('/api/v1/products?limit=2');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(typeof res.body.pageInfo.hasMore).toBe('boolean');
  });

  it('admin creates a product; customer is forbidden', async () => {
    await http.post('/api/v1/auth/register').send(admin);
    await prisma.user.update({
      where: { email: admin.email },
      data: { role: Role.ADMIN },
    });
    const login = await http
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: admin.password });
    expect(login.status).toBe(200);
    adminAccess = login.body.accessToken;

    category = await prisma.category.upsert({
      where: { slug: 'e2e-category' },
      update: {},
      create: { name: 'فئة اختبار', slug: 'e2e-category' },
    });
    const payload = {
      name: 'لوحة مفاتيح ميكانيكية',
      slug: `mech-keyboard-${randomUUID().slice(0, 8)}`,
      price: 39900,
      stock: 10,
      categoryId: category.id,
      description: 'لوحة مفاتيح اختبارية',
    };
    const denied = await http
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${customerAccess}`)
      .send(payload);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    const created = await http
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminAccess}`)
      .send(payload);
    expect(created.status).toBe(201);
    product = created.body;

    const pub = await http.get(`/api/v1/products/${product.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.price).toBe(39900);
  });

  it('manages the cart and enforces ownership', async () => {
    const add = await http
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAccess}`)
      .send({ productId: product.id, quantity: 2 });
    expect(add.status).toBe(201);
    const itemId = add.body.data[0].id;

    const got = await http
      .get('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAccess}`);
    expect(got.status).toBe(200);
    expect(got.body.data).toHaveLength(1);

    const patched = await http
      .patch(`/api/v1/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${customerAccess}`)
      .send({ quantity: 3 });
    expect(patched.status).toBe(200);

    const removed = await http
      .delete(`/api/v1/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${customerAccess}`);
    expect(removed.status).toBe(200);
  });

  it('creates orders idempotently with atomic stock reservation', async () => {
    const before = await http.get(`/api/v1/products/${product.slug}`);
    const stockBefore = before.body.stock;

    const payload = { items: [{ productId: product.id, quantity: 2 }], paymentMethod: 'cod' };

    const keyUsed = `e2e-${randomUUID()}`;
    const first = await http
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerAccess}`)
      .set('Idempotency-Key', keyUsed)
      .send(payload);
    expect(first.status).toBe(201);
    expect(first.body.status).toBe('PENDING');
    expect(first.body.total).toBe(79800);

    const replay = await http
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerAccess}`)
      .set('Idempotency-Key', keyUsed)
      .send(payload);
    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(first.body.id);

    const after = await http.get(`/api/v1/products/${product.slug}`);
    expect(after.body.stock).toBe(stockBefore - 2);

    const missingKey = await http
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerAccess}`)
      .send(payload);
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('rejects insufficient stock and unknown products', async () => {
    const empty = await http
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerAccess}`)
      .set('Idempotency-Key', `e2e-${randomUUID()}`)
      .send({ items: [{ productId: product.id, quantity: 1_000 }], paymentMethod: 'cod' });
    expect(empty.status).toBe(409);
    expect(empty.body.error.code).toBe('INSUFFICIENT_STOCK');

    const ghost = await http
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerAccess}`)
      .set('Idempotency-Key', `e2e-${randomUUID()}`)
      .send({ items: [{ productId: randomUUID(), quantity: 1 }], paymentMethod: 'cod' });
    expect(ghost.status).toBe(404);
    expect(ghost.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('keeps orders private and cancels with restock', async () => {
    const list = await http
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${customerAccess}`);
    expect(list.status).toBe(200);
    const order = list.body.data[0];
    expect(order).toBeDefined();

    const stranger = await http
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${adminAccess}`);
    expect(stranger.status).toBe(404);

    const cancelled = await http
      .post(`/api/v1/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${customerAccess}`)
      .send({ reason: 'e2e' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const after = await http.get(`/api/v1/products/${product.slug}`);
    expect(after.body.stock).toBe(product.stock);
  });

  it('rotates refresh tokens and revokes on logout', async () => {
    const res = await http.post('/api/v1/auth/register').send({
      email: `refresh-${randomUUID()}@example.com`,
      password: customer.password,
      name: 'تحديث',
    });
    const { refreshToken } = res.body;

    const rotated = await http.post('/api/v1/auth/refresh').send({ refreshToken });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(refreshToken);

    const reused = await http.post('/api/v1/auth/refresh').send({ refreshToken });
    expect(reused.status).toBe(401);

    const logout = await http
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${rotated.body.accessToken}`)
      .send({ refreshToken: rotated.body.refreshToken });
    expect(logout.status).toBe(200);

    const revoked = await http.post('/api/v1/auth/refresh').send({
      refreshToken: rotated.body.refreshToken,
    });
    expect(revoked.status).toBe(401);
  });
});
