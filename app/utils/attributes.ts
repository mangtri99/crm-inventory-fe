import type { AttributeDef } from '~/types'

// Port of the design's `window.VertexAttrs` (attribute-store.js).
// Master list of variant attribute names + their preset values, persisted
// in localStorage. Used by the Create form's variant builder (and, later,
// the Attributes master page). SSR-safe reads fall back to the seed.

const KEY = 'vertex_attributes_v1'

const SEED: AttributeDef[] = [
  { id: 'a_data', name: 'Data', values: ['5GB', '10GB', '15GB'] },
  { id: 'a_duration', name: 'Duration', values: ['8 Days', '16 Days', '31 Days'] },
  { id: 'a_color', name: 'Color', values: ['Black', 'White', 'Blue'] },
  { id: 'a_size', name: 'Size', values: ['S', 'M', 'L'] },
  { id: 'a_model', name: 'Model Type', values: [] },
  { id: 'a_material', name: 'Material', values: [] },
  { id: 'a_style', name: 'Style', values: [] },
  { id: 'a_capacity', name: 'Capacity', values: [] }
]

function clone(a: AttributeDef): AttributeDef {
  return { id: a.id, name: a.name, type: a.type, values: (a.values || []).slice() }
}

export function loadAttributeDefs(): AttributeDef[] {
  if (import.meta.client) {
    try {
      const r = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (Array.isArray(r) && r.length) return r.map(clone)
    } catch {
      // ignore malformed storage
    }
  }
  return SEED.map(clone)
}

export function saveAttributeDefs(list: AttributeDef[]): void {
  if (import.meta.client) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list))
    } catch {
      // ignore storage failure
    }
  }
}

// How many stored products reference this attribute name (delete-protection).
export function attributeUsageCount(name: string): number {
  if (!import.meta.client) return 0
  const target = (name || '').toLowerCase()
  try {
    const products: { attributes?: { name?: string }[] }[] = JSON.parse(localStorage.getItem('vertex_products') || '[]') || []
    return products.filter(p =>
      (p.attributes || []).some(a => (a.name || '').toLowerCase() === target)
    ).length
  } catch {
    return 0
  }
}

export function attributeNames(list: AttributeDef[]): string[] {
  return list.map(a => a.name)
}

export function attributeValuesFor(list: AttributeDef[], name: string): string[] {
  const def = list.find(a => a.name === name)
  return def ? def.values.slice() : []
}

// Preset values still selectable for an attribute (presets minus already-chosen).
export function attributeAvailableFor(list: AttributeDef[], name: string, chosen: string[]): string[] {
  const used = chosen || []
  return attributeValuesFor(list, name).filter(v => used.indexOf(v) === -1)
}
