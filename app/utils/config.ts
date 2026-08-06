import type { ConfigDefaults, ConfigGroup, ConfigOverrides } from '~/types'

// Port of the design's `window.VertexConfig` (config-store.js).
// One Default scope + per-platform override maps, persisted in localStorage.
// Used by the centralized Configuration page and the per-platform config page.

const KEY = 'vertex_config_v1'

export const CONFIG_GROUPS: ConfigGroup[] = [
  { group: 'store', title: 'Store Information', icon: 'store', fields: [
    { key: 'storeName', label: 'Store Name', type: 'text', placeholder: 'e.g. Vertex Digital Marketing' },
    { key: 'phone', label: 'Phone', type: 'text', placeholder: 'e.g. +81 3-1234-5678' },
    { key: 'address', label: 'Address', type: 'textarea', placeholder: 'Street, city, postal code' }
  ] },
  { group: 'web', title: 'Web', icon: 'globe', fields: [
    { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'e.g. vdm.com', synced: true }
  ] },
  { group: 'contact', title: 'General Contact', icon: 'mail', fields: [
    { key: 'senderName', label: 'Sender Name', type: 'text', placeholder: 'e.g. VDM Support' },
    { key: 'senderEmail', label: 'Sender Email', type: 'text', placeholder: 'e.g. no-reply@vdm.com' }
  ] },
  { group: 'contactus', title: 'Contact Us', icon: 'message-circle', fields: [
    { key: 'contactEnabled', label: 'Enable Contact Us', type: 'toggle' },
    { key: 'contactEmail', label: 'Send Emails To', type: 'text', placeholder: 'e.g. support@vdm.com' }
  ] }
]

// Deterministic seed — exported so pages can init reactive state identically on
// server + first client paint (localStorage read deferred to onMounted).
export const CONFIG_DEFAULT_SEED: ConfigDefaults = {
  storeName: 'Vertex Digital Marketing',
  phone: '+81 3-1234-5678',
  address: '1-2-3 Shibuya, Tokyo 150-0002',
  baseUrl: 'vdm.com',
  senderName: 'VDM Support',
  senderEmail: 'no-reply@vdm.com',
  contactEnabled: true,
  contactEmail: 'support@vdm.com'
}

interface ConfigAll {
  default: ConfigDefaults
  [platformId: string]: ConfigDefaults | ConfigOverrides
}

export function loadConfigAll(): ConfigAll {
  let c: Partial<ConfigAll> = {}
  if (import.meta.client) {
    try {
      c = JSON.parse(localStorage.getItem(KEY) || '{}') || {}
    } catch {
      c = {}
    }
  }
  if (!c.default) c.default = JSON.parse(JSON.stringify(CONFIG_DEFAULT_SEED))
  return c as ConfigAll
}

function saveConfigAll(all: ConfigAll): void {
  if (import.meta.client) {
    try {
      localStorage.setItem(KEY, JSON.stringify(all))
    } catch {
      // ignore storage failure
    }
  }
}

export function loadConfigDefaults(): ConfigDefaults {
  return loadConfigAll().default
}
export function saveConfigDefaults(vals: ConfigDefaults): void {
  const all = loadConfigAll()
  all.default = vals
  saveConfigAll(all)
}

// per-platform overrides: { <key>: { override: bool, value } }
export function loadConfigOverrides(platformId: string): ConfigOverrides {
  return (loadConfigAll()[platformId] as ConfigOverrides) || {}
}
export function saveConfigOverrides(platformId: string, ov: ConfigOverrides): void {
  const all = loadConfigAll()
  all[platformId] = ov
  saveConfigAll(all)
}
