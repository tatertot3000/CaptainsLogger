/**
 * Global configuration for Demo / Public Showcase Mode.
 *
 * When VITE_PUBLIC_DEMO is 'true' (set via Cloudflare Pages environment variables
 * or npm run build:demo):
 * 1. Photo and image file uploads are completely disabled to prevent storage quota abuse.
 * 2. Supabase Cloud Sync configuration forms are hidden and locked.
 * 3. A discreet "Public Demo Mode" pill badge is surfaced in Settings.
 */

export const IS_DEMO_MODE: boolean =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PUBLIC_DEMO === 'true';

