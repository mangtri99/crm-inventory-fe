// ── Vertex inventory domain (design import) ──

export interface Category {
  id: string
  name: string
  parentId: string | null
  enabled: boolean
}

export interface CategoryFlatRow {
  id: string
  name: string
  depth: number
  selectable: boolean
  header: boolean
}

// Full-tree row for the Categories page tree panel (every node selectable).
export interface CategoryTreeRow {
  id: string
  name: string
  depth: number
  parentId: string | null
  enabled: boolean
  childCount: number
}

// Per-category product membership + per-scope storefront positions
// (design's `vertex_cat_products_v1`). scopes keyed by 'default' | platformId.
export interface CatScopeEntry {
  positions: Record<string, number>
  override?: boolean
}
export interface CatEntry {
  members: string[]
  scopes: Record<string, CatScopeEntry>
}

export interface Platform {
  id: string
  name: string
  code: string
  url: string
}

// Variant attribute master (attribute-store.js): a name + its preset values.
export interface AttributeDef {
  id: string
  name: string
  values: string[]
}

// Reusable Initial-Fee line-item component (fee-store.js).
export interface Fee {
  id: string
  name: string
  description: string
  system: boolean
}

// Configuration store (config-store.js): one Default scope + per-platform overrides.
export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'toggle'
  placeholder?: string
  synced?: boolean
}
export interface ConfigGroup {
  group: string
  title: string
  icon: string
  fields: ConfigField[]
}
export type ConfigValue = string | boolean
export type ConfigDefaults = Record<string, ConfigValue>
export interface ConfigOverride {
  override: boolean
  value: ConfigValue
}
export type ConfigOverrides = Record<string, ConfigOverride>

export type ProductType = 'single' | 'variant' | 'bundle'
export type ProductStatus = 'Active' | 'Inactive'

// A row backing the Dashboard "Recent Products" table.
export interface ProductRow {
  id?: string
  name: string
  sku: string
  reference?: string
  category?: string
  categoryId?: string
  categoryPath?: string
  status: ProductStatus
  productType: ProductType
  hasVariants: boolean
  variantCount: number
  platformIds: string[]
  platformNames?: string[]
  image?: string
  createdAt?: number
  isNew?: boolean
}

// The full record persisted to `vertex_products` by the Create form —
// a superset of the ProductRow the Dashboard table reads back.
export interface StoredProduct extends ProductRow {
  notes?: string
  description?: string
  overrides?: Record<string, unknown>
  imageName?: string
  bundle?: { components: { id: string, name: string, products: { id: string, name: string, sku: string }[] }[] } | null
  attributes?: { name: string, values: string[] }[]
  variants?: { name: string, sku: string, price: string, stock: string, active: boolean }[]
  pricing?: unknown[]
}

// Dashboard summary tile (distinct from the template's `Stat`).
export interface DashStat {
  label: string
  value: string
  delta: string
  deltaColor: string
  icon: string
  iconBg: string
  iconColor: string
}

export type FilterField = 'name' | 'variants' | 'sku' | 'category' | 'productType' | 'platform' | 'status'

export interface FilterRule {
  id: string
  field: FilterField
  operator: 'is' | 'contains'
  value: string
  enabled: boolean
}
