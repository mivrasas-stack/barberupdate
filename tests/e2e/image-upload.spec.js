import { test, expect } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { cleanupTestTenant } from '../../backend/test/tenant-cleanup.js';

const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const { createClient } = requireBackend('@supabase/supabase-js');
const pg = requireBackend('pg');
const base = 'http://127.0.0.1:8188/api/v1';

const state = {
  owner: null,
  ownerId: null,
  customer: null,
  customerId: null,
  tenantId: null,
  slug: null,
  barberId: null,
};

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const pool = new pg.Pool({
  connectionString: process.env.ADMIN_DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 8000
});

async function seedUser() {
  const email = 'barberos-itest-' + randomUUID() + '@example.com';
  const password = 'Ab!' + randomBytes(24).toString('hex');
  const added = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (added.error) throw added.error;
  const signed = await anon.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return { email, password, id: added.data.user.id, jwt: signed.data.session.access_token };
}

async function api(jwt, method, path, payload) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + jwt,
      ...(payload ? { 'Content-Type': 'application/json' } : {})
    },
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(15000)
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw Error(`API ${method} ${path} returned ${r.status}: ${data?.error || ''}`);
  return data;
}

test.describe('Barber Paradise - Professional Image Upload Component', () => {
  test.beforeAll(async () => {
    state.owner = await seedUser();
    state.ownerId = state.owner.id;
    state.customer = await seedUser();
    state.customerId = state.customer.id;

    // Slug format MUST match /^barberos-itest-[a-f0-9]{16}$/ for cleanupTestTenant
    const slug = 'barberos-itest-' + randomBytes(8).toString('hex');
    state.slug = slug;

    const shop = await api(state.owner.jwt, 'POST', '/tenants', {
      name: 'Barbería Upload Test',
      slug,
      currency: 'COP',
      timeZone: 'America/Bogota'
    });
    state.tenantId = shop.id;

    const barber = await api(state.owner.jwt, 'POST', `/tenants/${shop.id}/barbers`, {
      name: 'Barbero Upload Chromium',
      slug: 'barbero-upload-chromium'
    });
    state.barberId = barber.id;
  });

  test.afterAll(async () => {
    try {
      if (state.tenantId) await cleanupTestTenant(pool, state.tenantId);
    } finally {
      if (state.ownerId) await admin.auth.admin.deleteUser(state.ownerId);
      if (state.customerId) await admin.auth.admin.deleteUser(state.customerId);
      await pool.end();
    }
  });

  async function login(page, identity) {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /BIENVENIDO.*DE VUELTA/i }).first()).toBeVisible();
    await page.locator('input[type=email]').fill(identity.email);
    await page.locator('input[type=password]').fill(identity.password);
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();
    await expect(page).toHaveURL(/#\/(?:barberia|clientes|barbero)\//, { timeout: 20000 });
  }

  test('Component displays "Subir imagen" as primary button and "Usar URL externa" as secondary in Barberia Perfil', async ({ page }) => {
    await login(page, state.owner);
    await page.goto(`/login#/barberia/${state.slug}/perfil`);
    await page.waitForLoadState('networkidle');

    // Check gallery area has "Subir imagen" as main button
    const uploadBtn = page.locator('button:has-text("Subir imagen")').first();
    await expect(uploadBtn).toBeVisible({ timeout: 12000 });

    const externalUrlBtn = page.locator('button:has-text("Usar URL externa")').first();
    await expect(externalUrlBtn).toBeVisible();
  });

  test('External URL alternative works and adds photo in Barberia Perfil', async ({ page }) => {
    await login(page, state.owner);
    await page.goto(`/login#/barberia/${state.slug}/perfil`);
    await page.waitForLoadState('networkidle');

    const externalUrlBtn = page.locator('button:has-text("Usar URL externa")').first();
    await expect(externalUrlBtn).toBeVisible({ timeout: 12000 });
    await externalUrlBtn.click();

    const urlInput = page.locator('input[placeholder*="ejemplo.com"]').first();
    await expect(urlInput).toBeVisible();

    const testUrl = 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1';
    await urlInput.fill(testUrl);
    const applyBtn = page.locator('button:has-text("Aplicar")').first();
    await applyBtn.click();

    await expect(page.getByText('Fotografía agregada a la galería oficial').first()).toBeVisible({ timeout: 8000 });
  });

  test('Boutique new product modal includes ImageUpload with preview and upload button', async ({ page }) => {
    await login(page, state.owner);
    await page.goto(`/login#/barberia/${state.slug}/boutique`);
    await page.waitForLoadState('networkidle');

    const newProdBtn = page.locator('button:has-text("Nuevo Producto")').first();
    await expect(newProdBtn).toBeVisible({ timeout: 12000 });
    await newProdBtn.click();

    // Verify ImageUpload inside the modal
    await expect(page.locator('label:has-text("Fotografía del Producto")')).toBeVisible();
    await expect(page.locator('button:has-text("Subir imagen")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Usar URL externa")').first()).toBeVisible();
  });

  test('Barbers team view includes ImageUpload in portfolio manager modal', async ({ page }) => {
    await login(page, state.owner);
    await page.goto(`/login#/barberia/${state.slug}/barberos`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Barberos & Equipo")')).toBeVisible({ timeout: 12000 });

    const managePortfolioBtn = page.locator('button[title="Gestionar Portafolio"]').first();
    await expect(managePortfolioBtn).toBeVisible();
    await managePortfolioBtn.click();

    await expect(page.locator('text=Límite reglamentario:')).toBeVisible();
    await expect(page.locator('button:has-text("Subir imagen")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Usar URL externa")').first()).toBeVisible();
  });

  test('Customer profile allows avatar customization via ImageUpload', async ({ page }) => {
    await login(page, state.customer);
    await page.goto(`/login#/clientes/perfil`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Mi Perfil de Cliente")')).toBeVisible({ timeout: 12000 });
    const editBtn = page.locator('button[title="Cambiar foto de perfil"]').first();
    await expect(editBtn).toBeVisible();

    await editBtn.click();
    await expect(page.locator('text=Subir nueva foto de perfil')).toBeVisible();
    await expect(page.locator('button:has-text("Subir imagen")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Usar URL externa")').first()).toBeVisible();
  });
});
