/** True when the dormant looper UI should load (not exposed in normal UI). */
export function isLooperDevMode(): boolean {
  if (import.meta.env.VITE_ENABLE_LOOPER === 'true') return true
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('mode') === 'looper'
}
