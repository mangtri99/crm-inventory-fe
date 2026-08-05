<script setup lang="ts">
import type {
  Category,
  DashStat,
  FilterField,
  FilterRule,
  Platform,
  ProductRow
} from '~/types'

useHead({ title: 'Dashboard — Vertex' })

const router = useRouter()

// ── reactive state (mirrors the design's DCLogic component state) ──
const search = ref('')
const filtersOpen = ref(false)
const page = ref(1)
const moreHoverKey = ref<string | null>(null)

const categories = ref<Category[]>([])
const platforms = ref<Platform[]>([])
// products persisted by the "Create New Product" screen; browser-only.
const storedProducts = ref<ProductRow[]>([])
const nowTs = ref(0)

let ridCounter = 0
const nextRid = () => 'r' + (++ridCounter)

// Filters start pre-populated with four disabled-by-value rules, matching
// the design's componentDidMount seed (empty value => not yet "active").
const rules = ref<FilterRule[]>([
  { id: nextRid(), field: 'variants', operator: 'is', value: '', enabled: true },
  { id: nextRid(), field: 'productType', operator: 'is', value: '', enabled: true },
  { id: nextRid(), field: 'platform', operator: 'is', value: '', enabled: true },
  { id: nextRid(), field: 'status', operator: 'is', value: '', enabled: true }
])

// SSR-safe browser reads happen only after mount.
onMounted(() => {
  categories.value = loadCategories()
  platforms.value = loadPlatforms()
  nowTs.value = Date.now()
  try {
    const raw = JSON.parse(localStorage.getItem('vertex_products') || '[]')
    if (Array.isArray(raw)) storedProducts.value = raw
  } catch {
    // ignore malformed storage
  }
})

// ── static demo data ──
const stats: DashStat[] = [
  { label: 'Total Products', value: '148', delta: '+12 this month', deltaColor: '#00a155', icon: 'i-lucide-package', iconBg: '#ecfdf5', iconColor: '#00a155' },
  { label: 'Active', value: '121', delta: '82% of catalog', deltaColor: '#64748b', icon: 'i-lucide-circle-check', iconBg: '#ecfdf5', iconColor: '#00a155' },
  { label: 'With Variants', value: '34', delta: '+4 this month', deltaColor: '#00a155', icon: 'i-lucide-layers', iconBg: '#ecfdf5', iconColor: '#00a155' },
  { label: 'Low Stock', value: '9', delta: 'Needs attention', deltaColor: '#dc2626', icon: 'i-lucide-triangle-alert', iconBg: '#fef2f2', iconColor: '#dc2626' }
]

interface DemoProduct {
  name: string
  sku: string
  category: string
  status: 'Active' | 'Inactive'
  productType: 'single' | 'variant' | 'bundle'
  hasVariants: boolean
  variantCount: number
  platformIds: string[]
}

const demoProducts: DemoProduct[] = [
  { name: 'Tourist SIM 15GB', sku: 'SKU-2000', category: 'SIM Card', status: 'Active', productType: 'single', hasVariants: true, variantCount: 6, platformIds: ['p_sp', 'p_sk'] },
  { name: 'Unlimited Data Plan 30D', sku: 'SKU-2003', category: 'Data Plan', status: 'Active', productType: 'single', hasVariants: false, variantCount: 0, platformIds: ['p_sk'] },
  { name: 'Pocket WiFi Router X1', sku: 'SKU-2002', category: 'WiFi', status: 'Active', productType: 'single', hasVariants: true, variantCount: 4, platformIds: ['p_sp'] },
  { name: 'Travel Connectivity Bundle', sku: 'SKU-2006', category: 'SIM Card', status: 'Active', productType: 'bundle', hasVariants: false, variantCount: 0, platformIds: ['p_sp', 'p_sk'] },
  { name: 'eSIM Global 5GB', sku: 'SKU-2005', category: 'SIM Card', status: 'Inactive', productType: 'single', hasVariants: false, variantCount: 0, platformIds: ['p_sp'] },
  { name: 'Prepaid Data Plan 7D', sku: 'SKU-2004', category: 'Data Plan', status: 'Active', productType: 'single', hasVariants: true, variantCount: 3, platformIds: ['p_sk'] }
]

// ── filter field definitions ──
interface FieldOption {
  value: string
  label: string
}
interface FieldDef {
  key: FilterField
  label: string
  type: 'text' | 'choice'
  options?: FieldOption[]
}

const fieldDefs = computed<FieldDef[]>(() => {
  const cats = categories.value
  const plats = platforms.value
  return [
    { key: 'name', label: 'Product Name', type: 'text' },
    { key: 'variants', label: 'Variants', type: 'choice', options: [{ value: 'yes', label: 'Has variants' }, { value: 'no', label: 'No variants' }] },
    { key: 'sku', label: 'SKU', type: 'text' },
    { key: 'category', label: 'Category', type: 'choice', options: flattenCategories(cats).map(o => ({ value: o.id, label: (o.depth ? '— ' : '') + o.name })) },
    { key: 'productType', label: 'Type', type: 'choice', options: [{ value: 'single', label: 'Single' }, { value: 'variant', label: 'Variant' }, { value: 'bundle', label: 'Bundle' }] },
    { key: 'platform', label: 'Platforms', type: 'choice', options: plats.map(p => ({ value: p.id, label: p.name })) },
    { key: 'status', label: 'Status', type: 'choice', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] }
  ]
})

const defByKey = (k: FilterField): FieldDef => fieldDefs.value.find(f => f.key === k) || fieldDefs.value[0]!

// ── enriched rows (stored products first, then demo) ──
interface EnrichedRow {
  key: string
  name: string
  sku: string
  status: 'Active' | 'Inactive'
  productType: 'single' | 'variant' | 'bundle'
  typeLabel: string
  hasVariants: boolean
  variantCount: number
  noVariants: boolean
  isNew: boolean
  image?: string
  catId: string | null
  categoryLabel: string
  productCategory: string
  platformIdList: string[]
  platformChips: string[]
  platformMore: boolean
  platformMoreLabel: string
  platformMoreTitle: string
  hasPlatforms: boolean
  onViewDetail: () => void
}

const allRows = computed<EnrichedRow[]>(() => {
  const cats = categories.value
  const plats = platforms.value

  const stored: EnrichedRow[] = storedProducts.value.map((r) => {
    const t0 = r.productType || 'single'
    const migType = t0 === 'variant' ? 'variant' : (t0 === 'bundle' ? 'bundle' : ((r.hasVariants || (r.variantCount && r.variantCount > 0)) ? 'variant' : 'single'))
    const hasVariants = t0 === 'variant' ? true : (r.hasVariants !== undefined ? !!r.hasVariants : (r.variantCount || 0) > 0)
    const vCount = r.variantCount || 0
    return enrich({
      key: r.id || r.sku,
      name: r.name,
      sku: r.sku,
      status: r.status,
      productType: migType,
      hasVariants,
      variantCount: hasVariants ? vCount : 0,
      isNew: !r.createdAt || (nowTs.value - r.createdAt) < 24 * 60 * 60 * 1000,
      image: r.image,
      productCategory: r.category || '',
      categoryId: r.categoryId,
      categoryPath: r.categoryPath,
      platformIds: r.platformIds || [],
      platformNames: r.platformNames
    }, cats, plats, () => { window.location.href = 'Product Detail.dc.html?id=' + encodeURIComponent(r.id || '') })
  })

  const demo: EnrichedRow[] = demoProducts.map(p => enrich({
    key: p.sku,
    name: p.name,
    sku: p.sku,
    status: p.status,
    productType: p.productType,
    hasVariants: p.hasVariants,
    variantCount: p.hasVariants ? p.variantCount : 0,
    isNew: false,
    productCategory: p.category,
    platformIds: p.platformIds
  }, cats, plats, () => { window.location.href = 'Product Detail.dc.html' }))

  return stored.concat(demo)
})

interface EnrichInput {
  key: string
  name: string
  sku: string
  status: 'Active' | 'Inactive'
  productType: 'single' | 'variant' | 'bundle'
  hasVariants: boolean
  variantCount: number
  isNew: boolean
  image?: string
  productCategory: string
  categoryId?: string
  categoryPath?: string
  platformIds: string[]
  platformNames?: string[]
}

function enrich(r: EnrichInput, cats: Category[], plats: Platform[], onViewDetail: () => void): EnrichedRow {
  let cat: Category | null = null
  if (r.categoryId) cat = categoryById(cats, r.categoryId)
  if (!cat) cat = categoryByName(cats, r.productCategory)
  const catId = cat ? cat.id : null
  const categoryLabel = r.categoryPath || (cat ? categoryPathById(cats, cat.id) : (r.productCategory || '—'))

  const ids = r.platformIds || []
  const names = (r.platformNames && r.platformNames.length)
    ? r.platformNames.slice()
    : ids.map(id => platformById(plats, id)?.name).filter((n): n is string => !!n)

  return {
    key: r.key,
    name: r.name,
    sku: r.sku,
    status: r.status,
    productType: r.productType,
    typeLabel: r.productType === 'bundle' ? 'Bundle' : (r.productType === 'variant' ? 'Variant' : 'Single'),
    hasVariants: r.hasVariants,
    variantCount: r.variantCount,
    noVariants: !r.hasVariants,
    isNew: r.isNew,
    image: r.image,
    catId,
    categoryLabel,
    productCategory: r.productCategory,
    platformIdList: ids,
    platformChips: names.slice(0, 2),
    platformMore: names.length > 2,
    platformMoreLabel: names.length > 2 ? ('+' + (names.length - 2)) : '',
    platformMoreTitle: names.length > 2 ? names.slice(2).join(', ') : '',
    hasPlatforms: names.length > 0,
    onViewDetail
  }
}

// ── filtering ──
const activeRules = computed(() => rules.value.filter(r => r.enabled && r.value !== '' && r.value != null))

function matchRule(row: EnrichedRow, rule: FilterRule): boolean {
  const contains = (a: string, b: string) => (a || '').toLowerCase().includes((b || '').toLowerCase())
  const isEq = (a: string, b: string) => (a || '').toLowerCase() === (b || '').toLowerCase()
  switch (rule.field) {
    case 'category': return categorySubtreeIds(categories.value, rule.value).indexOf(row.catId || '') !== -1
    case 'platform': return row.platformIdList.indexOf(rule.value) !== -1
    case 'productType': return (row.productType || 'single') === rule.value
    case 'status': return row.status === rule.value
    case 'variants': return rule.value === 'yes' ? !!row.hasVariants : !row.hasVariants
    case 'name': return rule.operator === 'is' ? isEq(row.name, rule.value) : contains(row.name, rule.value)
    case 'sku': return rule.operator === 'is' ? isEq(row.sku, rule.value) : contains(row.sku, rule.value)
    default: return true
  }
}

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  const rs = activeRules.value
  return allRows.value.filter((r) => {
    if (q && !(r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q))) return false
    for (const rule of rs) {
      if (!matchRule(r, rule)) return false
    }
    return true
  })
})

// ── pagination ──
const pageSize = 5
const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize)))
const clampedPage = computed(() => Math.min(page.value, totalPages.value))
const startIdx = computed(() => (clampedPage.value - 1) * pageSize)
const pagedRows = computed(() => filteredRows.value.slice(startIdx.value, startIdx.value + pageSize))

function goPage(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}

const pageNumbers = computed(() => Array.from({ length: totalPages.value }, (_, i) => i + 1))
const rangeFrom = computed(() => filteredRows.value.length === 0 ? 0 : startIdx.value + 1)
const rangeTo = computed(() => startIdx.value + pagedRows.value.length)
const rangeLabel = computed(() => `${rangeFrom.value}–${rangeTo.value} of ${filteredRows.value.length} row(s)`)

// ── filter rule rows for the popover ──
interface RuleRow {
  id: string
  field: FilterField
  fieldOptions: FieldOption[]
  isText: boolean
  isChoice: boolean
  value: string
  valueOptions: FieldOption[]
  enabled: boolean
}

const ruleRows = computed<RuleRow[]>(() => rules.value.map((rule) => {
  const def = defByKey(rule.field)
  const isText = def.type === 'text'
  return {
    id: rule.id,
    field: rule.field,
    fieldOptions: fieldDefs.value.map(f => ({ value: f.key, label: f.label })),
    isText,
    isChoice: !isText,
    value: rule.value,
    valueOptions: isText ? [] : (def.options || []),
    enabled: rule.enabled
  }
}))

function valueLabelOf(rule: FilterRule): string {
  const def = defByKey(rule.field)
  if (def.type === 'choice') {
    const o = (def.options || []).find(x => x.value === rule.value)
    return o ? o.label.replace('— ', '') : rule.value
  }
  return rule.value
}

const filterChips = computed(() => activeRules.value.map(rule => ({
  id: rule.id,
  label: defByKey(rule.field).label + ' ' + rule.operator + ' ' + valueLabelOf(rule)
})))

// ── rule mutations ──
function updateRule(id: string, patch: Partial<FilterRule>) {
  rules.value = rules.value.map(r => r.id === id ? { ...r, ...patch } : r)
  page.value = 1
}
function changeRuleField(id: string, field: FilterField) {
  const def = fieldDefs.value.find(f => f.key === field)
  updateRule(id, { field, operator: def && def.type === 'text' ? 'contains' : 'is', value: '' })
}
function addRule() {
  rules.value = [...rules.value, { id: nextRid(), field: 'category', operator: 'is', value: '', enabled: true }]
  page.value = 1
}
function removeRule(id: string) {
  rules.value = rules.value.filter(r => r.id !== id)
  page.value = 1
}
function clearRules() {
  rules.value = []
  page.value = 1
}

// ── derived UI helpers ──
function statusBadgeClass(status: string) {
  return status === 'Active'
    ? 'bg-emerald-50 text-green-600 border-emerald-200'
    : 'bg-slate-100 text-slate-500 border-slate-200'
}

const hasActiveFilters = computed(() => activeRules.value.length > 0)

function onNewProduct() {
  router.push('/products/new')
}
</script>

<template>
  <div class="px-8 pt-7 pb-20">
    <!-- HEADER -->
    <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 mb-1">
          Dashboard
        </h1>
        <p class="text-[15px] text-slate-500 m-0">
          Overview of your product catalog and inventory.
        </p>
      </div>
      <button
        class="border-none bg-green-500 text-white text-[15px] font-bold px-[18px] py-[9px] rounded-lg cursor-pointer inline-flex items-center gap-1.5 shadow-sm hover:bg-green-600 transition-colors"
        @click="onNewProduct"
      >
        <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />
        Create New Product
      </button>
    </div>

    <!-- SUMMARY STATS -->
    <div class="grid grid-cols-4 gap-4 mb-6 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-[18px]"
      >
        <div class="flex items-center justify-between mb-3">
          <span class="text-[15px] font-semibold text-slate-500">{{ stat.label }}</span>
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center"
            :style="{ background: stat.iconBg, color: stat.iconColor }"
          >
            <UIcon :name="stat.icon" class="w-4 h-4" />
          </div>
        </div>
        <div class="text-[26px] font-bold text-slate-900 leading-none">
          {{ stat.value }}
        </div>
        <div class="text-sm mt-2 font-semibold" :style="{ color: stat.deltaColor }">
          {{ stat.delta }}
        </div>
      </div>
    </div>

    <!-- RECENT PRODUCTS -->
    <div class="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div>
          <h2 class="text-base font-bold text-slate-900 m-0">
            Recent Products
          </h2>
          <p class="text-[15px] text-slate-500 mt-0.5">
            Your most recently updated items.
          </p>
        </div>
      </div>

      <!-- search + filters -->
      <div class="px-5 py-3.5 border-b border-slate-200">
        <div class="flex items-center gap-3 flex-wrap">
          <div class="relative flex-1 min-w-[220px]">
            <UIcon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              v-model="search"
              placeholder="Search by name or SKU..."
              class="w-full border border-slate-200 rounded-lg py-[9px] pr-3 pl-9 text-base text-slate-900 outline-none focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15"
              @input="page = 1"
            >
          </div>
          <div class="relative flex-shrink-0">
            <button
              class="relative inline-flex items-center gap-2 bg-white text-slate-700 text-[15px] font-semibold px-4 py-[9px] rounded-lg cursor-pointer border transition-colors"
              :class="[
                (filtersOpen || hasActiveFilters) ? 'border-green-500' : 'border-slate-200',
                filtersOpen ? 'ring-[3px] ring-green-500/15' : ''
              ]"
              @click="filtersOpen = !filtersOpen"
            >
              <UIcon name="i-lucide-sliders-horizontal" class="w-4 h-4" />
              Filters
              <span
                v-if="hasActiveFilters"
                class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-green-500 text-white text-xs font-bold"
              >{{ activeRules.length }}</span>
            </button>

            <!-- popover -->
            <template v-if="filtersOpen">
              <div class="fixed inset-0 z-40" @click="filtersOpen = false" />
              <div class="absolute top-[calc(100%+8px)] right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-[0_12px_34px_rgba(0,0,0,0.16)] w-[520px] max-w-[88vw]">
                <div class="px-[18px] pt-4 pb-1">
                  <div class="text-[13px] font-semibold text-slate-500 mb-3">
                    In this table show products
                  </div>
                  <div v-if="rules.length" class="flex flex-col gap-2.5">
                    <div
                      v-for="rule in ruleRows"
                      :key="rule.id"
                      class="flex items-center gap-2 flex-nowrap"
                    >
                      <div class="w-[150px] flex-shrink-0">
                        <select
                          class="ff-select"
                          :value="rule.field"
                          @change="changeRuleField(rule.id, ($event.target as HTMLSelectElement).value as FilterField)"
                        >
                          <option v-for="f in rule.fieldOptions" :key="f.value" :value="f.value">
                            {{ f.label }}
                          </option>
                        </select>
                      </div>
                      <div v-if="rule.isChoice" class="flex-1 min-w-0">
                        <select
                          class="ff-select"
                          :value="rule.value"
                          @change="updateRule(rule.id, { value: ($event.target as HTMLSelectElement).value })"
                        >
                          <option value="">
                            Select value
                          </option>
                          <option v-for="o in rule.valueOptions" :key="o.value" :value="o.value">
                            {{ o.label }}
                          </option>
                        </select>
                      </div>
                      <input
                        v-else
                        :value="rule.value"
                        placeholder="Enter value"
                        class="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-green-500"
                        @input="updateRule(rule.id, { value: ($event.target as HTMLInputElement).value })"
                      >
                      <label class="inline-flex items-center flex-shrink-0 cursor-pointer px-0.5" title="Enable rule">
                        <input
                          type="checkbox"
                          :checked="rule.enabled"
                          class="w-4 h-4 cursor-pointer accent-green-500"
                          @change="updateRule(rule.id, { enabled: ($event.target as HTMLInputElement).checked })"
                        >
                      </label>
                      <button
                        class="border border-slate-200 bg-white text-slate-400 w-[34px] h-[34px] rounded-lg cursor-pointer inline-flex items-center justify-center flex-shrink-0 hover:text-red-600 hover:border-red-200 transition-colors"
                        title="Delete rule"
                        @click="removeRule(rule.id)"
                      >
                        <UIcon name="i-lucide-trash-2" class="w-[15px] h-[15px]" />
                      </button>
                    </div>
                  </div>
                  <div
                    v-else
                    class="p-[18px] text-center text-sm text-slate-400 border-[1.5px] border-dashed border-slate-200 rounded-[10px]"
                  >
                    No filters yet. Add a rule to narrow the list.
                  </div>
                </div>
                <div class="flex items-center justify-between gap-3 px-[18px] py-3.5">
                  <button
                    class="inline-flex items-center gap-1.5 border-none bg-transparent text-green-600 text-sm font-bold cursor-pointer p-1"
                    @click="addRule"
                  >
                    <UIcon name="i-lucide-plus" class="w-[15px] h-[15px]" /> Add new
                  </button>
                  <button
                    v-if="rules.length"
                    class="inline-flex items-center gap-1.5 border-none bg-transparent text-red-600 text-sm font-semibold cursor-pointer p-1"
                    @click="clearRules"
                  >
                    <UIcon name="i-lucide-x" class="w-3.5 h-3.5" /> Clear all
                  </button>
                </div>
                <div class="flex justify-end gap-2.5 px-[18px] py-3 border-t border-slate-100">
                  <button
                    class="border-none bg-green-500 text-white text-sm font-bold px-[18px] py-2 rounded-lg cursor-pointer hover:bg-green-600 transition-colors"
                    @click="filtersOpen = false"
                  >
                    Done
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- active filter chips -->
        <div v-if="hasActiveFilters" class="mt-3 flex flex-wrap gap-2 items-center">
          <span
            v-for="chip in filterChips"
            :key="chip.id"
            class="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full py-1 pr-2 pl-3 text-[13px] font-semibold"
          >
            {{ chip.label }}
            <button
              class="border-none bg-transparent cursor-pointer text-emerald-700 flex items-center p-0.5 rounded-full"
              title="Remove"
              @click="removeRule(chip.id)"
            >
              <UIcon name="i-lucide-x" class="w-3 h-3" />
            </button>
          </span>
          <button
            class="border-none bg-transparent text-slate-500 text-[13px] font-semibold cursor-pointer px-1.5 py-1"
            @click="clearRules"
          >
            Clear all
          </button>
        </div>
      </div>

      <!-- table -->
      <div class="overflow-x-auto">
        <table class="w-full border-collapse min-w-[1020px]">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-5 py-3">
                Product Name
              </th>
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-3">
                Variants
              </th>
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-3">
                SKU
              </th>
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-3">
                Category
              </th>
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-3">
                Type
              </th>
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-3">
                Platforms
              </th>
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-3">
                Status
              </th>
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-5 py-3 w-[150px]">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="prod in pagedRows"
              :key="prod.key"
              class="border-b border-slate-100 hover:bg-slate-50"
            >
              <td class="px-5 py-3 whitespace-nowrap">
                <div class="flex items-center gap-2.5">
                  <img
                    v-if="prod.image"
                    :src="prod.image"
                    class="w-7 h-7 rounded-md object-cover flex-shrink-0"
                  >
                  <span class="text-base font-semibold text-slate-900">{{ prod.name }}</span>
                  <span
                    v-if="prod.isNew"
                    class="inline-flex items-center text-[10px] font-bold tracking-[0.04em] uppercase px-[7px] py-0.5 rounded-full bg-green-500 text-white flex-shrink-0"
                  >New</span>
                </div>
              </td>
              <td class="px-3 py-3 whitespace-nowrap">
                <span
                  v-if="prod.hasVariants"
                  class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-green-600 border border-emerald-200"
                >
                  <UIcon name="i-lucide-layers" class="w-[11px] h-[11px]" />{{ prod.variantCount }} variants
                </span>
                <span v-else class="text-[15px] text-slate-300">—</span>
              </td>
              <td class="px-3 py-3 text-[15px] text-slate-500 whitespace-nowrap">
                {{ prod.sku }}
              </td>
              <td class="px-3 py-3 text-[15px] text-slate-700 whitespace-nowrap">
                {{ prod.categoryLabel }}
              </td>
              <td class="px-3 py-3 whitespace-nowrap">
                <span class="text-sm font-semibold text-slate-700">{{ prod.typeLabel }}</span>
              </td>
              <td class="px-3 py-3">
                <div v-if="prod.hasPlatforms" class="flex flex-wrap gap-1 max-w-[190px]">
                  <span
                    v-for="pl in prod.platformChips"
                    :key="pl"
                    class="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-[9px] py-0.5 whitespace-nowrap"
                  >{{ pl }}</span>
                  <span
                    v-if="prod.platformMore"
                    class="relative inline-flex"
                    @mouseover="moreHoverKey = prod.sku"
                    @mouseout="moreHoverKey = null"
                  >
                    <span
                      class="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap cursor-default transition-colors"
                      :class="moreHoverKey === prod.sku ? 'bg-slate-200 text-slate-700' : 'text-slate-400'"
                    >{{ prod.platformMoreLabel }}</span>
                    <span
                      v-if="moreHoverKey === prod.sku"
                      class="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-xs font-medium px-2.5 py-[5px] rounded-md whitespace-nowrap shadow-lg"
                    >{{ prod.platformMoreTitle }}</span>
                  </span>
                </div>
                <span v-else class="text-[15px] text-slate-300">—</span>
              </td>
              <td class="px-3 py-3 whitespace-nowrap">
                <span
                  class="inline-block text-sm font-bold px-3 py-[3px] rounded-full border"
                  :class="statusBadgeClass(prod.status)"
                >{{ prod.status }}</span>
              </td>
              <td class="px-5 py-3 whitespace-nowrap">
                <button
                  class="border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  @click="prod.onViewDetail()"
                >
                  View Detail
                </button>
              </td>
            </tr>
            <tr v-if="filteredRows.length === 0">
              <td colspan="8" class="px-5 py-12 text-center">
                <div class="flex flex-col items-center gap-2 text-slate-400">
                  <UIcon name="i-lucide-search-x" class="w-7 h-7" />
                  <span class="text-base font-semibold text-slate-700">No products found</span>
                  <span class="text-[15px]">Try adjusting your search or filters.</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- pagination -->
      <div
        v-if="filteredRows.length > 0"
        class="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 flex-wrap"
      >
        <span class="text-[15px] text-slate-500">{{ rangeLabel }}</span>
        <div class="flex items-center gap-1.5">
          <button
            class="w-8 h-8 rounded-lg inline-flex items-center justify-center border border-slate-200 bg-white"
            :class="clampedPage <= 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 cursor-pointer hover:bg-slate-50'"
            title="Previous"
            @click="goPage(clampedPage - 1)"
          >
            <UIcon name="i-lucide-chevron-left" class="w-4 h-4" />
          </button>
          <button
            v-for="p in pageNumbers"
            :key="p"
            class="min-w-8 h-8 px-2 rounded-lg text-[15px] font-semibold inline-flex items-center justify-center border cursor-pointer"
            :class="p === clampedPage ? 'bg-green-500 text-white border-green-500' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'"
            @click="goPage(p)"
          >
            {{ p }}
          </button>
          <button
            class="w-8 h-8 rounded-lg inline-flex items-center justify-center border border-slate-200 bg-white"
            :class="clampedPage >= totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 cursor-pointer hover:bg-slate-50'"
            title="Next"
            @click="goPage(clampedPage + 1)"
          >
            <UIcon name="i-lucide-chevron-right" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Native select styling from the design's `.ff-select`. */
.ff-select {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 7px 20px 7px 12px;
  font-size: 14px;
  color: #0f172a;
  background-color: #fff;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 16px center;
  background-size: 16px 16px;
  outline: none;
  cursor: pointer;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.ff-select:focus {
  border-color: #00c16a;
  box-shadow: 0 0 0 3px rgba(0, 193, 106, 0.15);
}
</style>
