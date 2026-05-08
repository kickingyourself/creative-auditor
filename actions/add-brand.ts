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

// ─── Return type ──────────────────────────────────────────────────────────────

export type AddBrandState =
  | { status: 'idle' }
  | { status: 'success'; brand: { id: string; name: string } }
  | { status: 'error'; code: string; message: string };

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
  return { status: 'success', brand };
}
