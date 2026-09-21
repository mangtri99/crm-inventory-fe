<script setup lang="ts">
import type {
  Category,
  DashStat,
  Platform,
  ProductType,
  StoredProduct
} from '~/types'

useHead({ title: 'Dashboard — Vertex' })

const router = useRouter()

// ── seed catalog (design's SEED_PRODUCTS) ──
// Written to `vertex_products` on first mount when the store is empty, so the
// dashboard, Product Detail and Variant Detail all read the same records.
const SEED_PRODUCTS: StoredProduct[] = [
  {
    id: 'p_tourist',
    name: 'Tourist SIM 15GB',
    sku: 'SKU-2000',
    category: 'SIM Card',
    categoryId: 'c_sim',
    status: 'Active',
    productType: 'variant',
    hasVariants: true,
    variantCount: 6,
    platformIds: ['p_sp', 'p_sk'],
    attributes: [{ name: 'Data', values: ['15GB'] }, { name: 'Duration', values: ['8 Days', '16 Days', '31 Days'] }],
    variants: [
      { name: '15GB / 8 Days', sku: 'SKU-2000-01', price: '24', stock: '42', active: true },
      { name: '15GB / 16 Days', sku: 'SKU-2000-02', price: '32', stock: '28', active: true },
      { name: '15GB / 31 Days', sku: 'SKU-2000-03', price: '44', stock: '12', active: false }
    ]
  },
  {
    id: 'p_unlimited',
    name: 'Unlimited Data Plan 30D',
    sku: 'SKU-2003',
    category: 'Data Plan',
    categoryId: 'c_data',
    status: 'Active',
    productType: 'single',
    hasVariants: false,
    variantCount: 0,
    platformIds: ['p_sk'],
    attributes: [],
    variants: []
  },
  {
    id: 'p_wifi',
    name: 'Pocket WiFi Router X1',
    sku: 'SKU-2002',
    category: 'WiFi',
    categoryId: 'c_wifi',
    status: 'Active',
    productType: 'variant',
    hasVariants: true,
    variantCount: 4,
    platformIds: ['p_sp'],
    attributes: [{ name: 'Color', values: ['Black', 'White', 'Blue', 'Green'] }],
    variants: [
      { name: 'Black', sku: 'SKU-2002-01', price: '60', stock: '15', active: true },
      { name: 'White', sku: 'SKU-2002-02', price: '60', stock: '9', active: true },
      { name: 'Blue', sku: 'SKU-2002-03', price: '62', stock: '4', active: true },
      { name: 'Green', sku: 'SKU-2002-04', price: '62', stock: '0', active: false }
    ]
  },
  {
    id: 'p_bundle',
    name: 'Travel Connectivity Bundle',
    sku: 'SKU-2006',
    category: 'SIM Card',
    categoryId: 'c_sim',
    status: 'Active',
    productType: 'bundle',
    hasVariants: false,
    variantCount: 0,
    platformIds: ['p_sp', 'p_sk'],
    attributes: [],
    variants: []
  },
  {
    id: 'p_esim',
    name: 'eSIM Global 5GB',
    sku: 'SKU-2005',
    category: 'SIM Card',
    categoryId: 'c_sim',
    status: 'Inactive',
    productType: 'single',
    hasVariants: false,
    variantCount: 0,
    platformIds: ['p_sp'],
    attributes: [],
    variants: []
  },
  {
    id: 'p_prepaid',
    name: 'Prepaid Data Plan 7D',
    sku: 'SKU-2004',
    category: 'Data Plan',
    categoryId: 'c_data',
    status: 'Active',
    productType: 'variant',
    hasVariants: true,
    variantCount: 3,
    platformIds: ['p_sk'],
    attributes: [{ name: 'Data', values: ['3GB', '5GB', '10GB'] }],
    variants: [
      { name: '3GB', sku: 'SKU-2004-01', price: '12', stock: '30', active: true },
      { name: '5GB', sku: 'SKU-2004-02', price: '18', stock: '22', active: true },
      { name: '10GB', sku: 'SKU-2004-03', price: '28', stock: '11', active: true }
    ]
  }
]

// ── reactive state (mirrors the design's DCLogic component state) ──
const search = ref('')
const filtersOpen = ref(false)
const page = ref(1)
const moreHoverKey = ref<string | null>(null)
const expandedKeys = reactive<Record<string, boolean>>({})
const toast = ref<string | null>(null)

const catFilter = ref('')
const platFilter = ref('')
const typeFilter = ref('')
const statusFilter = ref('')

const categories = ref<Category[]>([])
const platforms = ref<Platform[]>([])
// Seeded so SSR and the first client render agree; replaced with the real
// store on mount.
const storedProducts = ref<StoredProduct[]>(SEED_PRODUCTS)
const nowTs = ref(0)

let toastTimer: ReturnType<typeof setTimeout> | undefined

// SSR-safe browser reads happen only after mount.
onMounted(() => {
  categories.value = loadCategories()
  platforms.value = loadPlatforms()
  nowTs.value = Date.now()

  try {
    const raw = JSON.parse(localStorage.getItem('vertex_products') || '[]')
    if (Array.isArray(raw) && raw.length) {
      storedProducts.value = raw
    } else {
      localStorage.setItem('vertex_products', JSON.stringify(SEED_PRODUCTS))
      storedProducts.value = SEED_PRODUCTS
    }
  } catch {
    // ignore malformed storage
  }

  try {
    const msg = sessionStorage.getItem('vertex_toast')
    if (msg) {
      sessionStorage.removeItem('vertex_toast')
      toast.value = msg
      toastTimer = setTimeout(() => {
        toast.value = null
      }, 3000)
    }
  } catch {
    // sessionStorage unavailable
  }
})

onBeforeUnmount(() => clearTimeout(toastTimer))

// ── summary tiles ──
const stats: DashStat[] = [
  { label: 'Total Products', value: '148', delta: '+12 this month', deltaColor: '#00a155', icon: 'i-lucide-package', iconBg: '#ecfdf5', iconColor: '#00a155' },
  { label: 'Active', value: '121', delta: '82% of catalog', deltaColor: '#64748b', icon: 'i-lucide-circle-check', iconBg: '#ecfdf5', iconColor: '#00a155' },
  { label: 'With Variants', value: '34', delta: '+4 this month', deltaColor: '#00a155', icon: 'i-lucide-layers', iconBg: '#ecfdf5', iconColor: '#00a155' },
  { label: 'Low Stock', value: '9', delta: 'Needs attention', deltaColor: '#dc2626', icon: 'i-lucide-triangle-alert', iconBg: '#fef2f2', iconColor: '#dc2626' }
]

// ── enriched rows ──
interface VariantRow {
  name: string
  sku: string
  subLabel: string
  statusLabel: string
  active: boolean
  onView: () => void
}

interface EnrichedRow {
  key: string
  name: string
  sku: string
  status: 'Active' | 'Inactive'
  productType: ProductType
  typeLabel: string
  hasVariants: boolean
  variantCount: number
  isNew: boolean
  image?: string
  catId: string | null
  categoryId?: string
  productCategory: string
  categoryLabel: string
  platformIdList: string[]
  platformChips: string[]
  platformMore: boolean
  platformMoreLabel: string
  platformMoreTitle: string
  hasPlatforms: boolean
  variantRows: VariantRow[]
  onViewDetail: () => void
}

const allRows = computed<EnrichedRow[]>(() => {
  const cats = categories.value
  const plats = platforms.value

  return storedProducts.value.map((r) => {
    const t0 = r.productType || 'single'
    const migType: ProductType = t0 === 'variant'
      ? 'variant'
      : (t0 === 'bundle' ? 'bundle' : ((r.hasVariants || (r.variants && r.variants.length)) ? 'variant' : 'single'))
    const hasVariants = t0 === 'variant'
      ? true
      : (r.hasVariants !== undefined ? !!r.hasVariants : !!(r.variants && r.variants.length > 0))
    const vCount = r.variants?.length ? r.variants.length : (r.variantCount || 0)

    let cat: Category | null = null
    if (r.categoryId) cat = categoryById(cats, r.categoryId)
    if (!cat) cat = categoryByName(cats, r.category || '')

    const ids = r.platformIds || []
    const names = (r.platformNames && r.platformNames.length)
      ? r.platformNames.slice()
      : ids.map(id => platformById(plats, id)?.name).filter((n): n is string => !!n)

    const key = r.id || r.sku
    // Real variant records when present, otherwise placeholders so a product
    // that only carries a count still expands.
    let vs = (hasVariants && r.variants?.length) ? r.variants : []
    if (!vs.length && hasVariants && vCount > 0) {
      vs = Array.from({ length: vCount }, (_, i) => ({
        name: r.name + ' — Variant ' + (i + 1),
        sku: (r.sku || 'SKU') + '-' + String(i + 1).padStart(2, '0'),
        price: '',
        stock: '',
        active: r.status !== 'Inactive'
      }))
    }

    return {
      key,
      name: r.name,
      sku: r.sku,
      status: r.status,
      productType: migType,
      typeLabel: migType === 'bundle' ? 'Bundle' : (migType === 'variant' ? 'Variant' : 'Single'),
      hasVariants,
      variantCount: hasVariants ? vCount : 0,
      isNew: !r.createdAt || (nowTs.value - r.createdAt) < 24 * 60 * 60 * 1000,
      image: r.image,
      catId: cat ? cat.id : null,
      categoryId: r.categoryId,
      productCategory: r.category || '',
      categoryLabel: r.categoryPath || (cat ? categoryPathById(cats, cat.id) : (r.category || '—')),
      platformIdList: ids,
      platformChips: names.slice(0, 2),
      platformMore: names.length > 2,
      platformMoreLabel: names.length > 2 ? ('+' + (names.length - 2)) : '',
      platformMoreTitle: names.length > 2 ? names.slice(2).join(', ') : '',
      hasPlatforms: names.length > 0,
      variantRows: vs.map(v => ({
        name: v.name,
        sku: v.sku || '—',
        subLabel: (v.price !== '' && v.price != null ? '¥' + Number(v.price).toFixed(2) : '—')
          + ' · Qty ' + (v.stock !== '' && v.stock != null ? v.stock : '0'),
        statusLabel: v.active ? 'Active' : 'Inactive',
        active: v.active,
        onView: () => {
          router.push({ path: '/products/variant-detail', query: { product: r.id || 'demo', variant: v.name } })
        }
      })),
      onViewDetail: () => { router.push({ path: '/products/detail', query: { id: r.id || '' } }) }
    }
  })
})

// ── filter dropdown options (only values actually present in the table) ──
const categoryOptions = computed(() => flattenCategories(categories.value)
  .filter(o => allRows.value.some(r => (r.categoryId || r.productCategory) === o.id || r.productCategory === o.name))
  .map(o => ({ value: o.id, label: o.name })))

const platformOptions = computed(() => platforms.value
  .filter(p => allRows.value.some(r => r.platformIdList.indexOf(p.id) !== -1))
  .map(p => ({ value: p.id, label: p.name })))

const hasActiveFilters = computed(() => !!(catFilter.value || platFilter.value || typeFilter.value || statusFilter.value))
const activeFilterCount = computed(() => [catFilter.value, platFilter.value, typeFilter.value, statusFilter.value].filter(Boolean).length)

function clearFilters() {
  catFilter.value = ''
  platFilter.value = ''
  typeFilter.value = ''
  statusFilter.value = ''
  page.value = 1
}

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  const catF = catFilter.value
  const platF = platFilter.value
  const typeF = typeFilter.value
  const statusF = statusFilter.value

  return allRows.value.filter((r) => {
    if (q && !(r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q))) return false
    if (catF && (r.categoryId || r.productCategory) !== catF && r.productCategory !== catF) return false
    if (platF && r.platformIdList.indexOf(platF) === -1) return false
    if (typeF) {
      const t = r.productType === 'bundle' ? 'bundle' : ((r.hasVariants || r.productType === 'variant') ? 'variant' : 'single')
      if (t !== typeF) return false
    }
    if (statusF && r.status !== statusF) return false
    return true
  })
})

// ── pagination ──
const pageSize = 15
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

function toggleExpand(key: string) {
  expandedKeys[key] = !expandedKeys[key]
}

// ── derived UI helpers ──
function statusBadgeClass(status: string) {
  return status === 'Active'
    ? 'bg-emerald-50 text-green-600 border-emerald-200'
    : 'bg-slate-100 text-slate-500 border-slate-200'
}

function onNewProduct() {
  router.push('/products/new')
}
</script>

<template>
  <div class="px-8 pt-7 pb-20">
    <!-- TOAST -->
    <div
      v-if="toast"
      class="fixed bottom-6 right-6 z-[300] bg-white border border-slate-200 border-l-4 border-l-green-500 rounded-[10px] shadow-[0_10px_30px_rgba(0,0,0,0.14)] px-[18px] py-3.5 flex items-center gap-3"
    >
      <UIcon name="i-lucide-circle-check" class="w-5 h-5 text-green-600" />
      <span class="text-[15px] font-semibold text-slate-900">{{ toast }}</span>
    </div>

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
        <div class="text-[34px] font-bold text-slate-900 leading-none">
          {{ stat.value }}
        </div>
        <div class="text-[15px] mt-2 font-semibold" :style="{ color: stat.deltaColor }">
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
        <div class="flex items-center gap-2.5 flex-wrap">
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
              class="relative inline-flex items-center gap-2 bg-white text-slate-700 text-[15px] font-semibold px-4 py-[9px] rounded-lg cursor-pointer border flex-shrink-0 transition-colors"
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
              >{{ activeFilterCount }}</span>
              <UIcon
                :name="filtersOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="w-[15px] h-[15px] text-slate-400"
              />
            </button>

            <!-- popover -->
            <template v-if="filtersOpen">
              <div class="fixed inset-0 z-40" @click="filtersOpen = false" />
              <div class="absolute top-[calc(100%+8px)] right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-[0_12px_34px_rgba(0,0,0,0.16)] w-[300px] p-4">
                <div class="flex flex-col gap-3.5">
                  <div>
                    <label class="text-[13px] font-semibold text-slate-700 mb-1.5 block">Category</label>
                    <select
                      v-model="catFilter"
                      class="ff-select"
                      @change="page = 1"
                    >
                      <option value="">
                        All categories
                      </option>
                      <option v-for="o in categoryOptions" :key="o.value" :value="o.value">
                        {{ o.label }}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label class="text-[13px] font-semibold text-slate-700 mb-1.5 block">Platform</label>
                    <select
                      v-model="platFilter"
                      class="ff-select"
                      @change="page = 1"
                    >
                      <option value="">
                        All platforms
                      </option>
                      <option v-for="o in platformOptions" :key="o.value" :value="o.value">
                        {{ o.label }}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label class="text-[13px] font-semibold text-slate-700 mb-1.5 block">Product Type</label>
                    <select
                      v-model="typeFilter"
                      class="ff-select"
                      @change="page = 1"
                    >
                      <option value="">
                        All types
                      </option>
                      <option value="single">
                        Single
                      </option>
                      <option value="variant">
                        Variant
                      </option>
                      <option value="bundle">
                        Bundle
                      </option>
                    </select>
                  </div>
                  <div>
                    <label class="text-[13px] font-semibold text-slate-700 mb-1.5 block">Status</label>
                    <select
                      v-model="statusFilter"
                      class="ff-select"
                      @change="page = 1"
                    >
                      <option value="">
                        All statuses
                      </option>
                      <option value="Active">
                        Active
                      </option>
                      <option value="Inactive">
                        Inactive
                      </option>
                    </select>
                  </div>
                  <button
                    v-if="hasActiveFilters"
                    class="border border-slate-200 bg-white text-slate-500 text-sm font-semibold cursor-pointer p-2 rounded-lg inline-flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors"
                    @click="clearFilters"
                  >
                    <UIcon name="i-lucide-x" class="w-3.5 h-3.5" /> Clear all
                  </button>
                </div>
              </div>
            </template>
          </div>
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
            <template v-for="prod in pagedRows" :key="prod.key">
              <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="px-5 py-3 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <button
                      v-if="prod.variantRows.length"
                      class="border-none bg-transparent cursor-pointer text-slate-500 w-[22px] h-[22px] inline-flex items-center justify-center rounded-md flex-shrink-0 hover:bg-slate-100"
                      title="Toggle variants"
                      @click="toggleExpand(prod.key)"
                    >
                      <UIcon
                        :name="expandedKeys[prod.key] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                        class="w-4 h-4"
                      />
                    </button>
                    <span v-else class="w-[22px] flex-shrink-0 inline-block" />
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

              <!-- expanded variant sub-rows -->
              <tr
                v-for="v in (expandedKeys[prod.key] ? prod.variantRows : [])"
                :key="prod.key + '|' + v.name"
                class="border-b border-slate-100 bg-neutral-50"
              >
                <td class="px-5 py-[9px] whitespace-nowrap">
                  <div class="flex items-center gap-2 pl-[38px]">
                    <UIcon name="i-lucide-corner-down-right" class="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                    <div>
                      <div class="text-sm font-medium text-slate-700">
                        {{ v.name }}
                      </div>
                      <div class="text-xs text-slate-400">
                        {{ v.subLabel }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-[9px]" />
                <td class="px-3 py-[9px] text-sm text-slate-500 whitespace-nowrap">
                  {{ v.sku }}
                </td>
                <td class="px-3 py-[9px] text-sm text-slate-300 whitespace-nowrap">
                  —
                </td>
                <td class="px-3 py-[9px] whitespace-nowrap">
                  <span class="text-[13px] font-semibold text-slate-400">Variant</span>
                </td>
                <td class="px-3 py-[9px] text-sm text-slate-300 whitespace-nowrap">
                  —
                </td>
                <td class="px-3 py-[9px] whitespace-nowrap">
                  <span
                    class="inline-block text-sm font-bold px-3 py-[3px] rounded-full border"
                    :class="statusBadgeClass(v.statusLabel)"
                  >{{ v.statusLabel }}</span>
                </td>
                <td class="px-5 py-[9px] whitespace-nowrap">
                  <button
                    class="border border-slate-200 bg-white text-slate-700 text-[13px] font-semibold px-2.5 py-[5px] rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                    @click="v.onView()"
                  >
                    View
                  </button>
                </td>
              </tr>
            </template>

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
  padding: 9px 20px 9px 12px;
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
