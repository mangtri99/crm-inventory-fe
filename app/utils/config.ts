import type { ConfigGroup, ConfigValues } from '~/types'

// Port of the design's Configuration screen store.
// Each platform owns its full set of values — there is no Default scope and no
// per-field override (that model was dropped in Master v3).

const KEY = 'vertex_platform_config_v1'

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

// Independent seed per platform — no base, each platform owns its full values.
export const PLATFORM_CONFIG_SEED: Record<string, ConfigValues> = {
  p_general: { storeName: 'Vertex Digital Marketing', phone: '+81 3-1234-5678', address: '1-2-3 Shibuya, Tokyo 150-0002', senderName: 'VDM Support', senderEmail: 'no-reply@vdm.com', contactEnabled: true, contactEmail: 'support@vdm.com' },
  p_sp: { storeName: 'SIM Point', phone: '+81 3-2345-6789', address: '4-5-6 Shinjuku, Tokyo 160-0022', senderName: 'SIM Point Support', senderEmail: 'no-reply@sim-point.jp', contactEnabled: true, contactEmail: 'support@sim-point.jp' },
  p_sk: { storeName: 'SK-SIM', phone: '+81 3-3456-7890', address: '7-8-9 Shibuya, Tokyo 150-0001', senderName: 'SK-SIM Support', senderEmail: 'no-reply@sk-sim.jp', contactEnabled: true, contactEmail: 'support@sk-sim.jp' }
}

export const GENERIC_CONFIG_SEED: ConfigValues = {
  storeName: '',
  phone: '',
  address: '',
  senderName: '',
  senderEmail: '',
  contactEnabled: true,
  contactEmail: ''
}

// Deterministic — safe to call during SSR so a ref can be initialised with the
// same value the first client paint produces.
export function platformConfigSeed(platformId: string): ConfigValues {
  return { ...(PLATFORM_CONFIG_SEED[platformId] || GENERIC_CONFIG_SEED) }
}

function loadConfigAll(): Record<string, ConfigValues> {
  if (!import.meta.client) return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {}
  } catch {
    return {}
  }
}

export function loadPlatformConfig(platformId: string): ConfigValues {
  return { ...platformConfigSeed(platformId), ...(loadConfigAll()[platformId] || {}) }
}

export function savePlatformConfig(platformId: string, cfg: ConfigValues): void {
  if (!import.meta.client) return
  const all = loadConfigAll()
  all[platformId] = cfg
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // ignore storage failure
  }
}
