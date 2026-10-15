/**
 * Secure Runtime Mapbox Token Resolver
 * Resolves token from:
 * 1. Vite environment variables (VITE_MAPBOX_TOKEN) - used for Vercel / Cloudflare builds
 * 2. Window runtime global (__MAPBOX_TOKEN__)
 * 3. Browser localStorage ('its_dt_mapbox_token') - user write-in fallback
 */
export function getMapboxToken(): string {
  // 1. Check Vite Environment Variable (injected by Vercel / Cloudflare / .env)
  const envToken = import.meta.env.VITE_MAPBOX_TOKEN
  if (envToken && typeof envToken === 'string' && envToken.trim() !== '') {
    return envToken.trim()
  }

  // 2. Check window runtime global
  const winToken = (window as any).__MAPBOX_TOKEN__
  if (winToken && typeof winToken === 'string' && winToken.trim() !== '') {
    return winToken.trim()
  }

  // 3. Check browser localStorage
  try {
    const stored = localStorage.getItem('its_dt_mapbox_token')
    if (stored && stored.trim() !== '') {
      return stored.trim()
    }
  } catch (e) {
    // Ignore localStorage restrictions
  }

  return ''
}

export function saveUserMapboxToken(token: string): void {
  try {
    if (token && token.trim()) {
      localStorage.setItem('its_dt_mapbox_token', token.trim())
    }
  } catch (e) {
    console.error('Failed to save token to localStorage:', e)
  }
}
