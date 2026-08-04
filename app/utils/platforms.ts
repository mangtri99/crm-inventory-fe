import type { Platform } from '~/types'

// Port of the design's `window.VertexPlatform` (platform-store.js).
// Flat list of sales platforms persisted in localStorage; SSR-safe reads.

const KEY = 'vertex_platforms_v2'
const GENERAL_ID = 'p_general'

const DEFAULTS: Platform[] = [
  { id: GENERAL_ID, name: 'General Website', code: 'general_website', url: 'vdm.com' },
  { id: 'p_sp', name: 'SIM Point', code: 'sim_point', url: 'vdm.com/sp-sim' },
  { id: 'p_sk', name: 'SK-SIM', code: 'sk_sim', url: 'vdm.com/sk-sim' }
]

function clone(p: Platform): Platform {
  return { id: p.id, name: p.name, code: p.code, url: p.url }
}

export function loadPlatforms(): Platform[] {
  if (import.meta.client) {
    try {
      const r = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (Array.isArray(r) && r.length) return r.map(clone)
    } catch {
      // ignore malformed storage
    }
  }
  return DEFAULTS.map(clone)
}

export function platformById(list: Platform[], id: string): Platform | null {
  return list.find(p => p.id === id) || null
}
