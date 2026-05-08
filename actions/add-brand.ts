'use server';

/**
 * actions/add-brand.ts
 *
 * Server Action: addBrand
 * Inserts a new row into the `brands` table and revalidates the /brands page.
 * Signature follows the useActionState contract:
 *   (prevState, formData) => Promise<AddBrandState>
 */

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// ─── Return type ──────────────────────────────────────────────────────────────

export type AddBrandState =
  | { status: 'idle' }
  | { status: 'success'; brand: { id: string; name: string } }
  | { status: 'error'; code: string; message: string };

// ─── Favicon helper ───────────────────────────────────────────────────────────

/**
 * Fetches the brand favicon via Google's Favicon API, uploads it to the
 * `creative-assets` Supabase Storage bucket, and returns the public URL.
 *
 * Uses the service-role client for storage writes (bypasses RLS).
 * Non-throwing — returns null on any failure so brand creation always succeeds.
 */
async function fetchAndStoreFavicon(
  brandId: string,
  websiteUrl: string
): Promise<string | null> {
  try {
    const domain = new URL(websiteUrl).hostname.replace(/^www\./, '');

    // Google's Favicon API — no key required, returns PNG at requested size.
    // Falls back gracefully to a generic globe icon when no favicon is found.
    const googleUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

    const res = await fetch(googleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CreativeAudit/1.0)' },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/png';
    const buffer = Buffer.from(await res.arrayBuffer());

    // Reject tiny responses — Google returns a 16×16 grey globe (≈ 148 bytes)
    // when it cannot find a real favicon. Skip storing those.
    if (buffer.byteLength < 200) return null;

    // Service-role client for storage writes
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (!supabaseUrl || !serviceKey) return null;

    const storage = createClient<Database>(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const storagePath = `logos/${brandId}/favicon.png`;

    const { error: uploadErr } = await storage
      .storage
      .from('creative-assets')
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (uploadErr) return null;

    const { data } = storage.storage.from('creative-assets').getPublicUrl(storagePath);
    return data.publicUrl;
  } catch {
    return null;
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function isValidUrl(url: string): boolean {
  if (!url) return true; // optional field — empty is fine
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Server Action ────────────────────────────────────────────────────────────

export async function addBrand(
  _prevState: AddBrandState,
  formData: FormData
): Promise<AddBrandState> {
  // ── 1. Extract fields ───────────────────────────────────────────────────────
  const name       = (formData.get('name') as string | null)?.trim() ?? '';
  const websiteRaw = (formData.get('website_url') as string | null)?.trim() ?? '';
  const logoRaw    = (formData.get('logo_url') as string | null)?.trim() ?? '';

  // ── 2. Validate ─────────────────────────────────────────────────────────────
  if (!name) {
    return { status: 'error', code: 'MISSING_NAME', message: 'Brand name is required.' };
  }
  if (name.length > 120) {
    return { status: 'error', code: 'NAME_TOO_LONG', message: 'Brand name must be 120 characters or fewer.' };
  }

  const websiteUrl = normalizeUrl(websiteRaw);
  const logoUrl    = normalizeUrl(logoRaw);

  if (!isValidUrl(websiteUrl)) {
    return { status: 'error', code: 'INVALID_WEBSITE', message: `"${websiteRaw}" is not a valid URL.` };
  }
  if (!isValidUrl(logoUrl)) {
    return { status: 'error', code: 'INVALID_LOGO_URL', message: `"${logoRaw}" is not a valid URL.` };
  }

  // ── 3. Insert ───────────────────────────────────────────────────────────────
  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return { status: 'error', code: 'MISSING_CONFIG', message: 'Supabase is not configured on the server.' };
  }

  const { data, error } = await supabase
    .from('brands')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ name, website_url: websiteUrl || null, logo_url: logoUrl || null } as any)
    .select('id, name')
    .single();

  if (error) {
    const pgCode = (error as unknown as { code?: string }).code;
    if (pgCode === '23505') {
      return { status: 'error', code: 'DUPLICATE_BRAND', message: `A brand named "${name}" already exists.` };
    }
    return { status: 'error', code: 'DB_ERROR', message: error.message };
  }

  // ── 4. Revalidate & return ──────────────────────────────────────────────────
  revalidatePath('/brands');
  revalidatePath('/');  // also refresh dashboard counts

  const brand = data as { id: string; name: string };

  // ── 5. Auto-fetch favicon (best-effort, non-blocking) ───────────────────────
  if (websiteUrl) {
    const faviconUrl = await fetchAndStoreFavicon(brand.id, websiteUrl);
    if (faviconUrl) {
      // Update logo_url — ignore errors (brand was already created successfully)
      await (supabase
        .from('brands') as unknown as { update: (v: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<unknown> } })
        .update({ logo_url: faviconUrl })
        .eq('id', brand.id);
    }
  }

  return { status: 'success', brand };
}
