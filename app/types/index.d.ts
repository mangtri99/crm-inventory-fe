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

export interface Platform {
  id: string
  name: string
  code: string
  url: string
}

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
