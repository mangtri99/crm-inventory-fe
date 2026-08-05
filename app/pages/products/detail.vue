<script setup lang="ts">
import type {
  AttributeDef,
  Category,
  Fee,
  Platform,
  ProductStatus,
  ProductType
} from '~/types'

useHead({ title: 'Product Detail — Vertex' })

const route = useRoute()
const router = useRouter()

// ── demo fallback (design's DEMO_PRODUCT / DEMO_PRICING) ──
interface DetailVariant { name: string, sku: string, price: number | string, stock: number | string, active: boolean, image?: string | null }
interface DetailProduct {
  id: string | null
  name: string
  sku: string
  productType: ProductType
  hasVariants?: boolean
  notes?: string
  category?: string
  categoryId?: string
  categoryPath?: string
  platform?: string
  platformIds: string[]
  platformNames?: string[]
  status: ProductStatus
  image?: string | null
  attributes?: { name: string, values: string[] }[]
  variants?: DetailVariant[]
  bundle?: { components: { name: string, products: { id?: string, name: string, sku: string }[] }[] } | null
  pricing?: PricingVersion[]
  overrides?: Overrides
  variantCount?: number
}
interface PricingVersion { version?: string, monthly?: string | number, initial?: number, components?: EditComp[], active?: boolean }
interface DemoPricing { version: string, monthlyFee: number, initialFee: number, status: ProductStatus }
interface EditAttr { id: string, name: string, values: string[] }
interface EditComp { feeId: string, published: boolean, amount: string }
interface ScopeOverride { name?: string, componentAmounts?: Record<string, string> }
type Overrides = Record<string, ScopeOverride>

const DEMO_PRODUCT: DetailProduct = {
  id: null,
  name: 'Tourist SIM 15GB',
  sku: 'SKU-2000',
  productType: 'variant',
  notes: 'Best seller for inbound travelers. Restocked every 6 weeks.',
  category: 'SIM Card',
  platform: 'SK SIM',
  platformIds: ['p_sk'],
  status: 'Active',
  image: null,
  attributes: [
    { name: 'Data', values: ['15GB'] },
    { name: 'Duration', values: ['8 Days', '16 Days', '31 Days'] }
  ],
  variants: [
    { name: '15GB / 8 Days', sku: 'SKU-2000-01', price: 24, stock: 42, active: true },
    { name: '15GB / 16 Days', sku: 'SKU-2000-02', price: 32, stock: 28, active: true },
    { name: '15GB / 31 Days', sku: 'SKU-2000-03', price: 44, stock: 12, active: false }
  ]
}

const DEMO_PRICING: DemoPricing[] = [
  { version: 'v1', monthlyFee: 12.0, initialFee: 0, status: 'Active' },
  { version: 'v2', monthlyFee: 15.0, initialFee: 25, status: 'Inactive' }
]

// ── state (mirrors the design's DCLogic component state) ──
const mode = ref<'view' | 'edit'>('view')
const openDropdown = ref<string | null>(null)
const scope = ref('default')
const draftOverrides = ref<Overrides>({})
const editMonthly = ref<string | number>('')
const editInitialComponents = ref<EditComp[]>([])
const editAttributes = ref<EditAttr[]>([])
const editVariants = ref<DetailVariant[]>([])
const errors = ref<{ name?: string }>({})
const cancelConfirmOpen = ref(false)
const deleteConfirmOpen = ref(false)
const toastMessage = ref<string | null>(null)

const categories = ref<Category[]>([])
const platforms = ref<Platform[]>([])
const attributeDefs = ref<AttributeDef[]>([])
const fees = ref<Fee[]>([...FEE_SEED])

const isStored = ref(false)
let editSnapshot: string | null = null
let variantImageTarget: string | null = null
let toastTimer: number | null = null
let deleteTimer: number | null = null

const variantImageInput = ref<HTMLInputElement | null>(null)

function normalizeProduct(rec: DetailProduct | null): { product: DetailProduct, stored: boolean } {
  const base: DetailProduct = rec ? { ...DEMO_PRODUCT, ...rec } : { ...DEMO_PRODUCT }
  if (!base.platformIds) base.platformIds = []
  if (base.productType !== 'bundle') {
    const hv = base.productType === 'variant' || !!base.hasVariants || !!(base.variants && base.variants.length)
    base.productType = hv ? 'variant' : 'single'
    base.hasVariants = hv
  }
  return { product: base, stored: !!rec }
}

// SSR-safe: both server and first client paint render the DEMO product
// (deterministic); the real record is swapped in on mount.
const seededDemo = normalizeProduct(null).product
const product = ref<DetailProduct>({ ...seededDemo })
const draft = ref<DetailProduct>({ ...seededDemo })

function loadRecordById(rawId: unknown): DetailProduct | null {
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  if (!id) return null
  try {
    const list = JSON.parse(localStorage.getItem('vertex_products') || '[]')
    return list.find((r: DetailProduct) => r.id === id) || null
  } catch {
    return null
  }
}

onMounted(() => {
  categories.value = loadCategories()
  platforms.value = loadPlatforms()
  attributeDefs.value = loadAttributeDefs()
  fees.value = loadFees()
  const rec = loadRecordById(route.query.id)
  const norm = normalizeProduct(rec)
  product.value = norm.product
  draft.value = { ...norm.product }
  isStored.value = norm.stored
})

onBeforeUnmount(() => {
  if (toastTimer !== null) clearTimeout(toastTimer)
  if (deleteTimer !== null) clearTimeout(deleteTimer)
})

const isEditMode = computed(() => mode.value === 'edit')
const isViewMode = computed(() => mode.value === 'view')

// ── inline-style helpers (ported) ──
function trackStyle(active: boolean) {
  return `width:40px;height:22px;border-radius:999px;border:none;cursor:pointer;background:${active ? '#00c16a' : '#e2e8f0'};position:relative;padding:2px;display:inline-flex;align-items:center;flex-shrink:0;transition:background 150ms ease;`
}
function knobStyle(active: boolean) {
  return `width:18px;height:18px;border-radius:999px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.15);transform:translateX(${active ? '18px' : '0px'});transition:transform 150ms ease;display:block;`
}
function switchTrackCss(on: boolean, locked: boolean) {
  return `width:40px;height:22px;border-radius:999px;border:none;background:${on ? '#00c16a' : '#e2e8f0'};position:relative;padding:2px;display:inline-flex;align-items:center;transition:background 150ms ease;cursor:${locked ? 'not-allowed' : 'pointer'};${locked ? 'opacity:0.65;' : ''}`
}
function switchKnobCss(on: boolean) {
  return `width:18px;height:18px;border-radius:999px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.15);transform:translateX(${on ? '18px' : '0px'});transition:transform 150ms ease;display:block;`
}
function badgeStyle(status: string) {
  const active = status === 'Active'
  return `display:inline-block;font-size:12px;font-weight:700;padding:3px 12px;border-radius:999px;background:${active ? '#ecfdf5' : '#f1f5f9'};color:${active ? '#00a155' : '#64748b'};border:1px solid ${active ? '#a7f3d0' : '#e2e8f0'};`
}
function ddTrigger(open: boolean) {
  return `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:1px solid ${open ? '#00c16a' : '#e2e8f0'};border-radius:8px;padding:9px 12px;height:40px;font-size:14px;background:#fff;cursor:pointer;color:#0f172a;${open ? 'box-shadow:0 0 0 3px rgba(0,193,106,0.15);' : ''}`
}
function ddChevron(open: boolean) {
  return `display:inline-flex;align-items:center;color:#64748b;flex-shrink:0;transition:transform 150ms ease;transform:rotate(${open ? '180deg' : '0deg'});`
}
function ddOption(selected: boolean) {
  return `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:none;border-radius:6px;background:${selected ? '#ecfdf5' : 'transparent'};padding:8px 10px;font-size:14px;color:${selected ? '#047857' : '#334155'};font-weight:${selected ? 600 : 400};cursor:pointer;`
}
const BADGE_OVERRIDE = 'font-size:11px;font-weight:700;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;padding:1px 8px;white-space:nowrap;'
const BADGE_INHERIT = 'font-size:11px;font-weight:600;color:#64748b;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:1px 8px;white-space:nowrap;'

function toggleDropdown(key: string) {
  openDropdown.value = openDropdown.value === key ? null : key
}
function closeDropdown() {
  openDropdown.value = null
}

// ── attribute / variant helpers ──
function normalizeAttrs(p: DetailProduct): { name: string, values: string[] }[] {
  let attrs = p.attributes || []
  const firstVal = attrs.length ? (attrs[0]!.values || [])[0] : undefined
  if (attrs.length && typeof firstVal === 'object') {
    attrs = attrs.map(a => ({ name: a.name, values: (a.values as unknown as { label: string }[]).map(v => v.label) }))
  } else if (!attrs.length && p.variants && p.variants.length) {
    attrs = [{ name: 'Variant', values: p.variants.map(v => v.name) }]
  }
  return attrs.map(a => ({ name: a.name, values: [...a.values] }))
}
function regenerateVariants(attrs: EditAttr[], existing: DetailVariant[]): DetailVariant[] {
  const use = attrs.filter(a => a.name && a.name.trim() && a.values && a.values.length > 0)
  if (!use.length) return []
  let combos: string[][] = [[]]
  use.forEach((a) => {
    const next: string[][] = []
    combos.forEach(c => a.values.forEach(v => next.push([...c, v])))
    combos = next
  })
  const byName: Record<string, DetailVariant> = {}
  ;(existing || []).forEach((v) => {
    byName[v.name] = v
  })
  return combos.map((c) => {
    const name = c.join(' / ')
    const ex = byName[name]
    return ex ? { ...ex, name } : { name, sku: '', price: '', stock: '', active: true, image: null }
  })
}
function seedEditState(p: DetailProduct) {
  const attrs = normalizeAttrs(p).map((a, i) => ({ id: 'ea' + i, name: a.name, values: [...a.values] }))
  const variants = regenerateVariants(attrs, p.variants || [])
  return { attrs, variants }
}

// ── category ──
const catFlat = computed(() =>
  flattenCategories(categories.value).map((o) => {
    const selected = o.selectable && o.id === draft.value.categoryId
    const style = o.header
      ? 'width:100%;text-align:left;border:none;background:transparent;padding:8px 10px 4px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;cursor:default;'
      : `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:none;border-radius:6px;background:${selected ? '#ecfdf5' : 'transparent'};padding:8px 10px;padding-left:${o.depth ? '28px' : '10px'};font-size:14px;color:${selected ? '#047857' : '#334155'};font-weight:${selected ? 600 : 400};cursor:pointer;`
    return { id: o.id, name: o.name, header: o.header, selected, style }
  })
)
const hasCat = computed(() => !!(draft.value.categoryId || draft.value.category))
const catDisplay = computed(() =>
  draft.value.categoryId ? categoryPathById(categories.value, draft.value.categoryId) : (draft.value.category || 'Select category')
)
function catPathOf(p: DetailProduct): string {
  if (p.categoryPath) return p.categoryPath
  if (p.categoryId) return categoryPathById(categories.value, p.categoryId)
  const c = p.category ? categoryByName(categories.value, p.category) : null
  return c ? categoryPathById(categories.value, c.id) : (p.category || '')
}
const categoryPathLabel = computed(() => catPathOf(product.value))
function pickCategory(id: string) {
  const cat = categoryById(categories.value, id)
  if (!cat) return
  draft.value = { ...draft.value, categoryId: id, category: cat.name }
  closeDropdown()
}

// ── platforms ──
const platformNamesOf = (ids: string[]) => (ids || []).map(id => platformById(platforms.value, id)?.name).filter((n): n is string => !!n)
const viewPlatformNames = computed(() => {
  const p = product.value
  let names = (p.platformNames && p.platformNames.length) ? p.platformNames.slice() : platformNamesOf(p.platformIds || [])
  if (!names.length && p.platform && p.platformIds && p.platformIds.length) names = [p.platform]
  return names
})
const editPlatformChips = computed(() =>
  (draft.value.platformIds || []).map(id => platformById(platforms.value, id)).filter((p): p is Platform => !!p)
)
const availablePlatforms = computed(() =>
  platforms.value.filter(p => (draft.value.platformIds || []).indexOf(p.id) === -1)
)
const platformAllAssigned = computed(() => platforms.value.length > 0 && availablePlatforms.value.length === 0)
const platformAddLabel = computed(() => editPlatformChips.value.length ? 'Add another platform' : 'Add platform')
function addDraftPlatform(id: string) {
  draft.value = { ...draft.value, platformIds: [...(draft.value.platformIds || []), id] }
  closeDropdown()
}
function removeDraftPlatform(id: string) {
  draft.value = { ...draft.value, platformIds: (draft.value.platformIds || []).filter(x => x !== id) }
}

// ── status ──
const draftActive = computed(() => draft.value.status === 'Active')
function toggleStatus() {
  draft.value = { ...draft.value, status: draftActive.value ? 'Inactive' : 'Active' }
}
const statusHelper = computed(() =>
  (isEditMode.value ? draftActive.value : product.value.status === 'Active')
    ? 'Active — available for use'
    : 'Inactive — hidden from use'
)

// ── scope ──
const assignedScopePlatforms = computed(() =>
  (draft.value.platformIds || []).map(id => platformById(platforms.value, id)).filter((p): p is Platform => !!p)
)
const showScopeCard = computed(() => assignedScopePlatforms.value.length > 0)
const isPlatformScope = computed(() => isEditMode.value && scope.value !== 'default')
const isViewPlatformScope = computed(() => !isEditMode.value && scope.value !== 'default')
const scopeOv = computed<ScopeOverride>(() => draftOverrides.value[scope.value] || {})
const scopeItems = computed(() =>
  [{ id: 'default', name: 'Default (All Platforms)' }]
    .concat(assignedScopePlatforms.value.map(p => ({ id: p.id, name: p.name })))
    .map(it => ({ id: it.id, name: it.name, selected: it.id === scope.value }))
)
const scopeLabel = computed(() => (scopeItems.value.find(x => x.id === scope.value) || scopeItems.value[0])?.name || 'Default (All Platforms)')
function setScope(id: string) {
  scope.value = id
  closeDropdown()
}

// ── name (scope-aware in edit) ──
const nameHasOverride = computed(() => isPlatformScope.value && Object.prototype.hasOwnProperty.call(scopeOv.value, 'name'))
const nameFieldValue = computed(() =>
  isPlatformScope.value ? (nameHasOverride.value ? scopeOv.value.name : draft.value.name) : draft.value.name
)
function onNameChange(e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (isPlatformScope.value) {
    const sc = scope.value
    draftOverrides.value = { ...draftOverrides.value, [sc]: { ...(draftOverrides.value[sc] || {}), name: val } }
  } else {
    draft.value = { ...draft.value, name: val }
  }
}
function onNameReset() {
  const sc = scope.value
  const o = { ...(draftOverrides.value[sc] || {}) }
  delete o.name
  draftOverrides.value = { ...draftOverrides.value, [sc]: o }
}

// ── variants (view) ──
const isVariantProduct = computed(() => !!product.value.hasVariants)
const isBundleProduct = computed(() => product.value.productType === 'bundle')
const bundleComps = computed(() => (product.value.bundle && product.value.bundle.components) ? product.value.bundle.components : [])
const bundleComponentRows = computed(() =>
  bundleComps.value.map(c => ({
    title: /component$/i.test((c.name || '').trim()) ? c.name.trim() : ((c.name || '').trim() + ' Component'),
    products: c.products || []
  }))
)
const viewVariantRows = computed(() =>
  (product.value.variants || []).map(v => ({
    name: v.name,
    skuLabel: v.sku || '—',
    attrChips: (v.name || '').split(' / '),
    priceLabel: (v.price !== '' && v.price != null) ? '¥' + Number(v.price).toFixed(2) : '—',
    stockLabel: (v.stock !== '' && v.stock != null) ? String(v.stock) : '—',
    statusLabel: v.active ? 'Active' : 'Inactive',
    statusBadgeStyle: badgeStyle(v.active ? 'Active' : 'Inactive')
  }))
)
const variantCountLabel = computed(() => {
  const n = isEditMode.value ? editVariants.value.length : (product.value.variants ? product.value.variants.length : 0)
  return n === 1 ? '1 variant' : n + ' variants'
})

// ── variant attribute builder (edit) ──
const attributeTypeOptions = computed(() => attributeNames(attributeDefs.value))
const editAttrRows = computed(() =>
  editAttributes.value.map((a) => {
    const options = attributeAvailableFor(attributeDefs.value, a.name, a.values)
    return {
      id: a.id,
      name: a.name,
      valueChips: a.values,
      valueOptions: options,
      canAddValue: !!a.name && options.length > 0,
      noValueOptions: !a.name || options.length === 0,
      valuesEmptyHint: a.name
        ? (attributeValuesFor(attributeDefs.value, a.name).length ? 'All values added' : 'No preset values — add on the Attributes page')
        : 'Select an attribute first'
    }
  })
)
function updateEditAttr(id: string, fn: (a: EditAttr) => EditAttr, regen = true) {
  const next = editAttributes.value.map(a => a.id === id ? fn(a) : a)
  editAttributes.value = next
  if (regen) editVariants.value = regenerateVariants(next, editVariants.value)
}
function onAttrNameChange(id: string, name: string) {
  updateEditAttr(id, a => ({ ...a, name, values: [] }), true)
}
function onAttrPickValue(id: string, e: Event) {
  const el = e.target as HTMLSelectElement
  const v = el.value
  el.value = ''
  if (!v) return
  updateEditAttr(id, a => a.values.indexOf(v) === -1 ? { ...a, values: [...a.values, v] } : a, true)
}
function removeAttrValue(id: string, value: string) {
  updateEditAttr(id, a => ({ ...a, values: a.values.filter(val => val !== value) }), true)
}
function removeEditAttr(id: string) {
  const next = editAttributes.value.filter(a => a.id !== id)
  editAttributes.value = next
  editVariants.value = regenerateVariants(next, editVariants.value)
}
function addEditAttribute() {
  editAttributes.value = [...editAttributes.value, { id: 'ea' + Date.now(), name: '', values: [] }]
}
function updateEditVariant(name: string, field: 'sku' | 'price' | 'stock' | 'image' | 'active', value: string | boolean) {
  editVariants.value = editVariants.value.map(v => v.name === name ? { ...v, [field]: value } : v)
}
function removeEditVariant(name: string) {
  editVariants.value = editVariants.value.filter(v => v.name !== name)
}
function pickVariantImage(name: string) {
  variantImageTarget = name
  if (variantImageInput.value) {
    variantImageInput.value.value = ''
    variantImageInput.value.click()
  }
}
function onVariantImageChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  const name = variantImageTarget
  if (!file || !name || !file.type.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = ev => updateEditVariant(name, 'image', String(ev.target?.result || ''))
  reader.readAsDataURL(file)
}

// ── pricing ──
const basePricing = computed<DemoPricing[]>(() => isStored.value ? [] : DEMO_PRICING.slice())
const pricingRows = computed(() =>
  basePricing.value.map(pr => ({
    version: pr.version,
    monthlyFeeLabel: '¥' + pr.monthlyFee.toFixed(2),
    initialFeeLabel: pr.initialFee ? '¥' + pr.initialFee.toFixed(2) : '—',
    status: pr.status,
    statusBadgeStyle: badgeStyle(pr.status)
  }))
)
const showPricingTable = computed(() => pricingRows.value.length > 0)
const showPricingEmpty = computed(() => pricingRows.value.length === 0)

const feeComponentsLocked = computed(() => scope.value !== 'default')
const canAddEditComponent = computed(() => scope.value === 'default')
const editInitialComponentRows = computed(() => {
  const locked = scope.value !== 'default'
  const chosen = editInitialComponents.value.map(c => c.feeId).filter(Boolean)
  const ovAmts = locked ? (draftOverrides.value[scope.value]?.componentAmounts || {}) : null
  return editInitialComponents.value.map((c, i) => {
    const fee = feeById(fees.value, c.feeId)
    const isBase = c.feeId === FEE_BASE_ID
    const options = fees.value.filter(f => f.id === c.feeId || chosen.indexOf(f.id) === -1)
    const amt = locked ? (ovAmts && ovAmts[c.feeId] !== undefined ? ovAmts[c.feeId] : '') : c.amount
    return {
      index: i,
      feeId: c.feeId,
      name: fee ? fee.name : 'Select component...',
      locked: isBase,
      selectable: !isBase,
      selectDisabled: locked,
      options: options.map(o => ({ id: o.id, name: o.name })),
      amount: amt,
      published: c.published,
      publishLocked: isBase || locked,
      publishTitle: isBase ? 'Base Price is always published' : (locked ? 'Publish is set in Default scope' : (c.published ? 'Published' : 'Unpublished')),
      publishTrackStyle: switchTrackCss(!!c.published, isBase || locked),
      publishKnobStyle: switchKnobCss(!!c.published),
      canRemove: !isBase && !locked,
      rowStyle: `display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #f1f5f9;${c.published ? '' : 'background:#fafafa;opacity:0.7;'}`
    }
  })
})
function onComponentSelect(i: number, feeId: string) {
  editInitialComponents.value = editInitialComponents.value.map((x, idx) => idx === i ? { ...x, feeId } : x)
}
function onComponentAmount(i: number, value: string) {
  if (scope.value === 'default') {
    editInitialComponents.value = editInitialComponents.value.map((x, idx) => idx === i ? { ...x, amount: value } : x)
    return
  }
  const sc = scope.value
  const cur = { ...(draftOverrides.value[sc] || {}) }
  const prev = cur.componentAmounts || {}
  const fid = editInitialComponents.value[i]!.feeId
  const amts: Record<string, string> = {}
  Object.keys(prev).forEach((k) => {
    if (k !== fid) amts[k] = prev[k]!
  })
  if (value !== '') amts[fid] = value
  cur.componentAmounts = amts
  draftOverrides.value = { ...draftOverrides.value, [sc]: cur }
}
function toggleComponentPublish(i: number) {
  const c = editInitialComponents.value[i]
  if (!c || c.feeId === FEE_BASE_ID || scope.value !== 'default') return
  editInitialComponents.value = editInitialComponents.value.map((x, idx) => idx === i ? { ...x, published: !x.published } : x)
}
function addEditComponent() {
  editInitialComponents.value = [...editInitialComponents.value, { feeId: '', published: true, amount: '' }]
}
function removeEditComponent(i: number) {
  editInitialComponents.value = editInitialComponents.value.filter((_, idx) => idx !== i)
}
const editInitialTotalLabel = computed(() => {
  const locked = scope.value !== 'default'
  const ovAmts = locked ? (draftOverrides.value[scope.value]?.componentAmounts || {}) : null
  const total = editInitialComponents.value.reduce((t, c) => {
    if (!c.published || !c.feeId) return t
    let a: string | number | undefined = c.amount
    if (locked && ovAmts) a = (ovAmts[c.feeId] !== undefined && ovAmts[c.feeId] !== '') ? ovAmts[c.feeId] : c.amount
    return t + (parseFloat(String(a)) || 0)
  }, 0)
  return '¥' + Math.round(total).toLocaleString('en-US')
})

// ── per-platform summary (view) ──
const baseMonthlyForSummary = computed(() =>
  isStored.value ? ((product.value.pricing && product.value.pricing[0]) ? product.value.pricing[0]!.monthly : '') : DEMO_PRICING[0]!.monthlyFee
)
function fmtY(v: string | number | undefined) {
  return (v === '' || v == null) ? '—' : '¥' + Number(v).toFixed(2)
}
const platformSummaryRows = computed(() => {
  const ovAll = product.value.overrides || {}
  return (product.value.platformIds || []).map((id) => {
    const pl = platformById(platforms.value, id)
    if (!pl) return null
    const o = ovAll[id] || {}
    const nameOv = Object.prototype.hasOwnProperty.call(o, 'name')
    const priceOv = Object.prototype.hasOwnProperty.call(o, 'priceMonthly' as keyof ScopeOverride)
    const priceVal = priceOv ? (o as { priceMonthly?: string | number }).priceMonthly : baseMonthlyForSummary.value
    return {
      platform: pl.name,
      name: nameOv ? o.name : product.value.name,
      nameTag: nameOv ? 'Overridden' : 'Inherited',
      nameTagStyle: nameOv ? BADGE_OVERRIDE : BADGE_INHERIT,
      price: fmtY(priceVal),
      priceTag: priceOv ? 'Overridden' : 'Inherited',
      priceTagStyle: priceOv ? BADGE_OVERRIDE : BADGE_INHERIT
    }
  }).filter((r): r is NonNullable<typeof r> => !!r)
})
const showPlatformSummary = computed(() => isViewMode.value && platformSummaryRows.value.length > 0)

const statusBadgeStyleProduct = computed(() => badgeStyle(product.value.status))
const notesDisplay = computed(() => product.value.notes && product.value.notes.trim() ? product.value.notes : '—')
const productTypeLabel = computed(() => product.value.productType ? product.value.productType.charAt(0).toUpperCase() + product.value.productType.slice(1) : '')

// ── mode transitions ──
function isDirty(): boolean {
  if (JSON.stringify(product.value) !== JSON.stringify(draft.value)) return true
  return editSnapshot !== JSON.stringify({ a: editAttributes.value, v: editVariants.value })
}
function onEditClick() {
  const seed = seedEditState(product.value)
  editSnapshot = JSON.stringify({ a: seed.attrs, v: seed.variants })
  const baseV = isStored.value
    ? ((product.value.pricing && product.value.pricing[0]) || {})
    : { monthlyFee: 12.0, components: [{ feeId: 'fee_base', published: true, amount: '' }, { feeId: 'fee_tax', published: true, amount: '' }, { feeId: 'fee_shipping', published: true, amount: '' }] }
  const srcComps = (baseV as PricingVersion).components
  const seedComps: EditComp[] = (srcComps && srcComps.length)
    ? srcComps.map(c => ({ feeId: c.feeId || 'fee_base', published: c.published === undefined ? true : !!c.published, amount: c.amount }))
    : [{ feeId: 'fee_base', published: true, amount: '' }, { feeId: 'fee_tax', published: true, amount: '' }, { feeId: 'fee_shipping', published: true, amount: '' }]
  const d: DetailProduct = { ...product.value }
  if (!d.categoryId && d.category) {
    const c = categoryByName(categories.value, d.category)
    if (c) d.categoryId = c.id
  }
  draft.value = d
  editAttributes.value = seed.attrs
  editVariants.value = seed.variants
  draftOverrides.value = JSON.parse(JSON.stringify(product.value.overrides || {}))
  const bv = baseV as PricingVersion & { monthlyFee?: number }
  editMonthly.value = bv.monthly != null ? bv.monthly : (bv.monthlyFee != null ? bv.monthlyFee : '')
  editInitialComponents.value = seedComps
  errors.value = {}
  scope.value = 'default'
  mode.value = 'edit'
}
function onCancelClick() {
  if (isDirty()) {
    cancelConfirmOpen.value = true
  } else {
    mode.value = 'view'
    errors.value = {}
  }
}
function onKeepEditing() {
  cancelConfirmOpen.value = false
}
function onConfirmDiscard() {
  const seed = seedEditState(product.value)
  draft.value = { ...product.value }
  editAttributes.value = seed.attrs
  editVariants.value = seed.variants
  cancelConfirmOpen.value = false
  errors.value = {}
  scope.value = 'default'
  mode.value = 'view'
}

function persist(merged: DetailProduct) {
  if (!isStored.value || !merged.id) return
  try {
    const list = JSON.parse(localStorage.getItem('vertex_products') || '[]')
    const idx = list.findIndex((r: DetailProduct) => r.id === merged.id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...merged }
      localStorage.setItem('vertex_products', JSON.stringify(list))
    }
  } catch {
    // ignore storage failure
  }
}
function onSaveClick() {
  const d = draft.value
  const errs: { name?: string } = {}
  if (!d.name || !d.name.trim()) errs.name = 'Product name is required.'
  if (Object.keys(errs).length) {
    errors.value = errs
    return
  }
  const merged: DetailProduct = { ...d }
  const comps = editInitialComponents.value.filter(c => c.feeId).map(c => ({ feeId: c.feeId, published: !!c.published, amount: c.amount }))
  const initTotal = comps.reduce((t, c) => t + (c.published ? (parseFloat(c.amount) || 0) : 0), 0)
  const existingV: PricingVersion = (d.pricing && d.pricing[0]) ? d.pricing[0]! : {}
  const headVersion: PricingVersion = {
    ...existingV,
    version: existingV.version || 'v1',
    monthly: editMonthly.value,
    initial: initTotal,
    components: comps,
    active: existingV.active !== undefined ? existingV.active : true
  }
  merged.pricing = [headVersion, ...(d.pricing || []).slice(1)]
  merged.platformIds = d.platformIds || []
  merged.platformNames = platformNamesOf(d.platformIds || [])
  const cleanOv: Overrides = {}
  Object.keys(draftOverrides.value).forEach((k) => {
    const o = draftOverrides.value[k]
    if (o && Object.keys(o).length) cleanOv[k] = o
  })
  merged.overrides = cleanOv
  merged.categoryPath = d.categoryId ? categoryPathById(categories.value, d.categoryId) : d.category
  if (product.value.hasVariants) {
    const cleanAttrs = editAttributes.value
      .filter(a => a.name.trim() && a.values.length > 0)
      .map(a => ({ name: a.name.trim(), values: [...a.values] }))
    merged.attributes = cleanAttrs
    merged.variants = regenerateVariants(editAttributes.value, editVariants.value)
      .map(v => ({ name: v.name, sku: v.sku, price: v.price, stock: v.stock, active: !!v.active, image: v.image || null }))
    // deviation from source: keep the denormalised count the Dashboard reads
    merged.variantCount = merged.variants.length
  }
  persist(merged)
  product.value = merged
  draft.value = { ...merged }
  mode.value = 'view'
  errors.value = {}
  toastMessage.value = 'Product updated successfully'
  toastTimer = window.setTimeout(() => {
    toastMessage.value = null
  }, 2800)
}

// ── delete ──
function onDeleteClick() {
  deleteConfirmOpen.value = true
}
function onCancelDelete() {
  deleteConfirmOpen.value = false
}
function onConfirmDelete() {
  if (isStored.value && product.value.id) {
    try {
      const list = JSON.parse(localStorage.getItem('vertex_products') || '[]')
      localStorage.setItem('vertex_products', JSON.stringify(list.filter((r: DetailProduct) => r.id !== product.value.id)))
    } catch {
      // ignore storage failure
    }
  }
  deleteConfirmOpen.value = false
  toastMessage.value = 'Product deleted'
  deleteTimer = window.setTimeout(() => router.push('/dashboard'), 1200)
}
</script>

<template>
  <div class="mx-auto max-w-[1280px] px-8 pt-8 pb-20">
    <!-- header -->
    <div class="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div>
        <div class="text-[13px] text-slate-500 mb-1">
          <NuxtLink to="/dashboard" class="text-green-600 no-underline hover:underline">
            Products
          </NuxtLink>
          / <span class="text-slate-900 font-semibold">{{ product.name }}</span>
        </div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-2xl font-bold text-slate-900 m-0">
            {{ product.name }}
          </h1>
          <span :style="statusBadgeStyleProduct">{{ product.status }}</span>
        </div>
      </div>

      <div v-if="isViewMode" class="flex gap-2.5">
        <button
          class="border border-red-200 bg-white text-red-600 text-sm font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer inline-flex items-center gap-1.5 hover:bg-red-50 transition-colors"
          @click="onDeleteClick"
        >
          <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" /> Delete
        </button>
        <button
          class="border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer inline-flex items-center gap-1.5 hover:bg-slate-50 transition-colors"
          @click="onEditClick"
        >
          <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" /> Edit
        </button>
      </div>

      <div v-if="isEditMode" class="flex gap-2.5">
        <button
          class="border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
          @click="onCancelClick"
        >
          Cancel
        </button>
        <button
          class="border-none bg-green-500 text-white text-sm font-bold px-5 py-[9px] rounded-lg cursor-pointer shadow-sm hover:bg-green-600 transition-colors"
          @click="onSaveClick"
        >
          Save Changes
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-6">
      <!-- scope card -->
      <div v-if="showScopeCard" class="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4">
        <div class="flex items-center gap-3.5 flex-wrap">
          <div class="flex items-center gap-2 flex-shrink-0">
            <UIcon name="i-lucide-layers" class="w-4 h-4 text-green-600" />
            <span class="text-sm font-bold text-slate-900">{{ isEditMode ? 'Editing for' : 'Viewing for' }}</span>
          </div>
          <div class="relative min-w-[260px]">
            <button type="button" :style="ddTrigger(openDropdown === 'scope')" @click="toggleDropdown('scope')">
              <span class="whitespace-nowrap overflow-hidden text-ellipsis">{{ scopeLabel }}</span>
              <span :style="ddChevron(openDropdown === 'scope')"><UIcon name="i-lucide-chevron-down" class="w-4 h-4" /></span>
            </button>
            <template v-if="openDropdown === 'scope'">
              <div class="fixed inset-0 z-40" @click="closeDropdown" />
              <div class="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.14)] p-1 max-h-[260px] overflow-y-auto">
                <button
                  v-for="opt in scopeItems"
                  :key="opt.id"
                  type="button"
                  :style="ddOption(opt.selected)"
                  @click="setScope(opt.id)"
                >
                  <span>{{ opt.name }}</span>
                  <UIcon v-if="opt.selected" name="i-lucide-check" class="w-[15px] h-[15px] text-green-600" />
                </button>
              </div>
            </template>
          </div>
          <span v-if="isPlatformScope" class="text-[12.5px] text-slate-500">Only <strong class="text-slate-700">Name</strong> and <strong class="text-slate-700">Price</strong> can be overridden here — other fields are global.</span>
          <span v-if="isViewPlatformScope" class="text-[12.5px] text-slate-500">Showing effective values for this platform. Click <strong class="text-slate-700">Edit</strong> to override them.</span>
        </div>
      </div>

      <!-- ROW 1: Core identification + Settings -->
      <div class="flex flex-wrap gap-6 items-stretch">
        <!-- Core identification -->
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-6 h-full min-w-0 grow-[999] shrink basis-[420px]">
          <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
            Core Identification
          </h2>
          <p class="text-[13px] text-slate-500 mt-0 mb-5">
            Basic details that identify this product.
          </p>

          <div class="grid gap-4 mb-4 grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))]">
            <!-- name -->
            <div>
              <template v-if="isViewMode">
                <span class="static-label">Product Name</span>
                <div class="static-value">
                  {{ product.name }}
                </div>
              </template>
              <template v-else>
                <div class="flex items-center justify-between gap-2">
                  <label class="field-label mb-1.5">Product Name</label>
                  <span v-if="isPlatformScope" :style="nameHasOverride ? BADGE_OVERRIDE : BADGE_INHERIT">{{ nameHasOverride ? 'Overridden' : 'Inherited' }}</span>
                </div>
                <input
                  :class="['field-input', errors.name ? 'has-error' : '']"
                  type="text"
                  :value="nameFieldValue"
                  placeholder="e.g. Tourist SIM 15GB"
                  @input="onNameChange"
                >
                <button
                  v-if="nameHasOverride"
                  class="mt-[5px] border-none bg-transparent text-green-600 text-xs font-semibold cursor-pointer p-0 inline-flex items-center gap-1"
                  @click="onNameReset"
                >
                  <UIcon name="i-lucide-rotate-ccw" class="w-[11px] h-[11px]" /> Reset to default
                </button>
                <div v-if="errors.name" class="text-xs text-red-600 mt-[5px]">
                  {{ errors.name }}
                </div>
              </template>
            </div>

            <!-- sku -->
            <div>
              <template v-if="isViewMode">
                <span class="static-label">SKU</span>
                <div class="static-value">
                  {{ product.sku }}
                </div>
              </template>
              <template v-else>
                <label class="field-label">SKU</label>
                <input
                  class="field-input"
                  type="text"
                  :value="draft.sku"
                  disabled
                  title="SKU cannot be changed after creation"
                >
                <div class="text-xs text-slate-400 mt-[5px] flex items-center gap-1">
                  <UIcon name="i-lucide-lock" class="w-[11px] h-[11px]" /> SKU cannot be changed after creation
                </div>
              </template>
            </div>

            <!-- product type -->
            <div>
              <template v-if="isViewMode">
                <span class="static-label">Product Type</span>
                <div class="static-value capitalize">
                  {{ product.productType }}
                </div>
              </template>
              <template v-else>
                <label class="field-label">Product Type</label>
                <input
                  class="field-input"
                  type="text"
                  :value="productTypeLabel"
                  disabled
                  title="Product type cannot be changed after creation"
                >
                <div class="text-xs text-slate-400 mt-[5px] flex items-center gap-1">
                  <UIcon name="i-lucide-lock" class="w-[11px] h-[11px]" /> Product type cannot be changed after creation
                </div>
              </template>
            </div>
          </div>

          <!-- notes -->
          <div class="mb-4">
            <template v-if="isViewMode">
              <span class="static-label">Notes</span>
              <div class="static-value font-normal text-slate-700 leading-normal">
                {{ notesDisplay }}
              </div>
            </template>
            <template v-else>
              <label class="field-label">Notes</label>
              <textarea
                class="field-input resize-y"
                rows="3"
                :value="draft.notes"
                placeholder="Internal notes about this product..."
                @input="draft.notes = ($event.target as HTMLTextAreaElement).value"
              />
            </template>
          </div>

          <!-- image -->
          <div>
            <span class="static-label">Product Image</span>
            <img
              v-if="product.image"
              :src="product.image"
              class="w-[120px] h-[120px] rounded-[10px] object-cover border border-slate-200 block"
            >
            <div
              v-else
              class="w-24 h-24 rounded-[10px] bg-slate-100 flex items-center justify-center text-slate-300 border border-slate-100"
            >
              <UIcon name="i-lucide-image" class="w-[26px] h-[26px]" />
            </div>
          </div>
        </div>

        <!-- Settings -->
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-6 h-full min-w-0 grow shrink basis-[320px]">
          <h2 class="text-base font-bold text-slate-900 mt-0 mb-5">
            Settings
          </h2>

          <!-- category -->
          <div class="mb-4">
            <template v-if="isViewMode">
              <span class="static-label">Category</span>
              <div class="static-value">
                {{ categoryPathLabel }}
              </div>
            </template>
            <template v-else>
              <label class="field-label">Category</label>
              <div class="relative">
                <button type="button" :style="ddTrigger(openDropdown === 'category')" @click="toggleDropdown('category')">
                  <span
                    class="whitespace-nowrap overflow-hidden text-ellipsis"
                    :class="hasCat ? 'text-slate-900' : 'text-slate-400'"
                  >{{ catDisplay }}</span>
                  <span :style="ddChevron(openDropdown === 'category')"><UIcon name="i-lucide-chevron-down" class="w-4 h-4" /></span>
                </button>
                <template v-if="openDropdown === 'category'">
                  <div class="fixed inset-0 z-40" @click="closeDropdown" />
                  <div class="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.14)] max-h-[280px] overflow-y-auto p-1">
                    <button
                      v-for="opt in catFlat"
                      :key="opt.id"
                      type="button"
                      :style="opt.style"
                      @click="opt.header ? null : pickCategory(opt.id)"
                    >
                      <span>{{ opt.name }}</span>
                      <UIcon v-if="opt.selected" name="i-lucide-check" class="w-[15px] h-[15px] text-green-600" />
                    </button>
                  </div>
                </template>
              </div>
            </template>
          </div>

          <!-- platforms -->
          <div class="mb-5">
            <template v-if="isViewMode">
              <span class="static-label">Platforms</span>
              <div v-if="viewPlatformNames.length" class="flex flex-wrap gap-1.5 mt-[5px]">
                <span
                  v-for="pl in viewPlatformNames"
                  :key="pl"
                  class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-[11px] py-[3px]"
                >
                  <UIcon name="i-lucide-globe" class="w-3 h-3 text-slate-400" />{{ pl }}
                </span>
              </div>
              <div v-else class="static-value text-slate-400">
                — No platform
              </div>
            </template>
            <template v-else>
              <label class="field-label">Platforms</label>
              <div v-if="editPlatformChips.length" class="flex flex-wrap gap-1.5 mb-2">
                <span
                  v-for="chip in editPlatformChips"
                  :key="chip.id"
                  class="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full py-1 pr-2 pl-3 text-[13px] font-semibold"
                >
                  {{ chip.name }}
                  <button
                    title="Remove"
                    class="border-none bg-transparent cursor-pointer text-emerald-700 flex items-center p-0.5 rounded-full"
                    @click="removeDraftPlatform(chip.id)"
                  >
                    <UIcon name="i-lucide-x" class="w-3 h-3" />
                  </button>
                </span>
              </div>
              <div class="relative">
                <button type="button" :style="ddTrigger(openDropdown === 'platform')" @click="toggleDropdown('platform')">
                  <span class="text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">{{ platformAddLabel }}</span>
                  <span :style="ddChevron(openDropdown === 'platform')"><UIcon name="i-lucide-chevron-down" class="w-4 h-4" /></span>
                </button>
                <template v-if="openDropdown === 'platform'">
                  <div class="fixed inset-0 z-40" @click="closeDropdown" />
                  <div class="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.14)] p-1 max-h-[220px] overflow-y-auto">
                    <button
                      v-for="opt in availablePlatforms"
                      :key="opt.id"
                      type="button"
                      :style="ddOption(false)"
                      @click="addDraftPlatform(opt.id)"
                    >
                      <span>{{ opt.name }}</span>
                    </button>
                    <div v-if="platformAllAssigned" class="p-2.5 text-[13px] text-slate-400 text-center">
                      All platforms assigned
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </div>

          <!-- status -->
          <div class="flex items-center justify-between pt-4 border-t border-slate-100">
            <div>
              <div class="text-sm font-semibold text-slate-900">
                Status
              </div>
              <div class="text-[13px] text-slate-500 mt-0.5">
                {{ statusHelper }}
              </div>
            </div>
            <span v-if="isViewMode" :style="statusBadgeStyleProduct">{{ product.status }}</span>
            <button v-else :style="trackStyle(draftActive)" @click="toggleStatus">
              <span :style="knobStyle(draftActive)" />
            </button>
          </div>
        </div>
      </div>

      <!-- ROW 2: variants / bundle + pricing -->
      <div class="flex flex-wrap gap-6">
        <div class="grow-[999] shrink basis-[420px] min-w-0 flex flex-col gap-6">
          <!-- VARIANTS -->
          <div v-if="isVariantProduct" class="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
              Variants
            </h2>
            <p class="text-[13px] text-slate-500 mt-0 mb-5">
              Define attributes, then generate variant combinations.
            </p>

            <!-- EDIT MODE -->
            <div v-if="isEditMode">
              <div class="flex items-center gap-2 mb-3.5">
                <span class="w-[22px] h-[22px] rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                <span class="text-sm font-bold text-slate-900">Define Attributes</span>
              </div>

              <div class="flex flex-col gap-3 mb-3">
                <div
                  v-for="attr in editAttrRows"
                  :key="attr.id"
                  class="border border-slate-200 rounded-[10px] px-4 py-3.5 bg-slate-50"
                >
                  <div class="flex flex-wrap gap-3 items-start">
                    <div class="basis-[150px] grow shrink min-w-[120px] max-w-[240px]">
                      <label class="field-label text-xs">Attribute Name</label>
                      <div class="select-wrap">
                        <select
                          class="field-input"
                          :value="attr.name"
                          @change="onAttrNameChange(attr.id, ($event.target as HTMLSelectElement).value)"
                        >
                          <option value="">
                            Select attribute...
                          </option>
                          <option v-for="opt in attributeTypeOptions" :key="opt" :value="opt">
                            {{ opt }}
                          </option>
                        </select>
                      </div>
                    </div>
                    <div class="basis-[170px] grow shrink min-w-0">
                      <label class="field-label text-xs">Values</label>
                      <div class="flex flex-wrap gap-1.5 items-center">
                        <span
                          v-for="chip in attr.valueChips"
                          :key="chip"
                          class="inline-flex basis-auto grow-0 shrink-0 items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full py-[3px] pr-1.5 pl-2.5 text-[13px] font-medium"
                        >
                          {{ chip }}
                          <button
                            class="border-none bg-transparent cursor-pointer text-emerald-700 flex items-center p-0.5 rounded-full"
                            @click="removeAttrValue(attr.id, chip)"
                          >
                            <UIcon name="i-lucide-x" class="w-3 h-3" />
                          </button>
                        </span>
                        <div v-if="attr.canAddValue" class="select-wrap basis-[130px] grow shrink min-w-[120px]">
                          <select
                            class="field-input text-[13px]"
                            :value="''"
                            @change="onAttrPickValue(attr.id, $event)"
                          >
                            <option value="">
                              + Add value
                            </option>
                            <option v-for="opt in attr.valueOptions" :key="opt" :value="opt">
                              {{ opt }}
                            </option>
                          </select>
                        </div>
                        <span v-if="attr.noValueOptions" class="text-xs text-slate-400 p-1">{{ attr.valuesEmptyHint }}</span>
                      </div>
                    </div>
                    <button
                      title="Remove attribute"
                      class="btn-icon-hover border border-slate-200 bg-white text-red-500 w-9 h-9 rounded-lg cursor-pointer flex items-center justify-center flex-shrink-0 mt-5"
                      @click="removeEditAttr(attr.id)"
                    >
                      <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <button
                class="inline-flex items-center gap-1.5 border border-dashed border-green-500 bg-emerald-50 text-green-600 text-[13px] font-semibold px-4 py-[9px] rounded-lg cursor-pointer mb-7"
                @click="addEditAttribute"
              >
                <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />
                Add Attribute
              </button>

              <div class="flex items-center justify-between mb-3.5">
                <div class="flex items-center gap-2">
                  <span class="w-[22px] h-[22px] rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <span class="text-sm font-bold text-slate-900">Variant Combinations</span>
                  <span class="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{{ variantCountLabel }}</span>
                </div>
              </div>

              <div class="border border-slate-200 rounded-[10px] overflow-hidden">
                <div class="overflow-x-auto">
                  <div class="min-w-[700px]">
                    <div class="grid grid-cols-[minmax(140px,1.4fr)_130px_110px_90px_60px_80px_40px] gap-2 items-center px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                      <span class="text-xs font-bold text-slate-500 uppercase tracking-[0.03em]">Variant</span>
                      <span class="text-xs font-bold text-slate-500 uppercase tracking-[0.03em]">SKU</span>
                      <span class="text-xs font-bold text-slate-500 uppercase tracking-[0.03em]">Price</span>
                      <span class="text-xs font-bold text-slate-500 uppercase tracking-[0.03em]">Stock</span>
                      <span class="text-xs font-bold text-slate-500 uppercase tracking-[0.03em] text-center">Image</span>
                      <span class="text-xs font-bold text-slate-500 uppercase tracking-[0.03em] text-center">Status</span>
                      <span />
                    </div>
                    <div
                      v-for="ev in editVariants"
                      :key="ev.name"
                      class="grid grid-cols-[minmax(140px,1.4fr)_130px_110px_90px_60px_80px_40px] gap-2 items-center px-4 py-2 border-b border-slate-100"
                    >
                      <span class="text-sm font-semibold text-slate-900">{{ ev.name }}</span>
                      <input
                        class="field-input px-2.5 py-[7px] text-[13px]"
                        type="text"
                        :value="ev.sku"
                        placeholder="SKU"
                        @input="updateEditVariant(ev.name, 'sku', ($event.target as HTMLInputElement).value)"
                      >
                      <div class="relative">
                        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">¥</span>
                        <input
                          class="field-input pl-[22px] pr-2.5 py-[7px] text-[13px]"
                          type="number"
                          :value="ev.price"
                          placeholder="0.00"
                          @input="updateEditVariant(ev.name, 'price', ($event.target as HTMLInputElement).value)"
                        >
                      </div>
                      <input
                        class="field-input px-2.5 py-[7px] text-[13px]"
                        type="number"
                        :value="ev.stock"
                        placeholder="0"
                        @input="updateEditVariant(ev.name, 'stock', ($event.target as HTMLInputElement).value)"
                      >
                      <div class="text-center">
                        <button
                          title="Upload image"
                          class="btn-icon-hover w-9 h-9 border border-dashed border-slate-300 rounded-lg bg-slate-50 cursor-pointer inline-flex items-center justify-center text-slate-400 overflow-hidden p-0"
                          @click="pickVariantImage(ev.name)"
                        >
                          <img v-if="ev.image" :src="ev.image" class="w-9 h-9 object-cover block">
                          <UIcon v-else name="i-lucide-image-plus" class="w-4 h-4" />
                        </button>
                      </div>
                      <div class="text-center">
                        <button :style="trackStyle(!!ev.active)" @click="updateEditVariant(ev.name, 'active', !ev.active)">
                          <span :style="knobStyle(!!ev.active)" />
                        </button>
                      </div>
                      <button
                        title="Delete variant"
                        class="btn-icon-hover border-none bg-transparent text-slate-400 w-8 h-8 rounded-lg cursor-pointer inline-flex items-center justify-center"
                        @click="removeEditVariant(ev.name)"
                      >
                        <UIcon name="i-lucide-trash-2" class="w-[15px] h-[15px]" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <input
                ref="variantImageInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onVariantImageChange"
              >
            </div>

            <!-- VIEW MODE -->
            <div v-else>
              <div class="flex items-center gap-2 mb-3.5">
                <span class="text-sm font-bold text-slate-900">Variant Combinations</span>
                <span class="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{{ variantCountLabel }}</span>
              </div>
              <div class="border border-slate-200 rounded-[10px] overflow-hidden">
                <div class="overflow-x-auto">
                  <table class="w-full border-collapse min-w-[640px]">
                    <thead>
                      <tr class="bg-slate-50 border-b border-slate-200">
                        <th class="text-left text-xs font-bold text-slate-500 uppercase tracking-[0.03em] px-4 py-[11px]">
                          Variant
                        </th>
                        <th class="text-left text-xs font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-[11px]">
                          Variant SKU
                        </th>
                        <th class="text-left text-xs font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-[11px]">
                          Attributes
                        </th>
                        <th class="text-left text-xs font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-[11px] w-[100px]">
                          Price
                        </th>
                        <th class="text-left text-xs font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-[11px] w-[90px]">
                          Stock
                        </th>
                        <th class="text-left text-xs font-bold text-slate-500 uppercase tracking-[0.03em] px-4 py-[11px] w-[100px]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="vv in viewVariantRows" :key="vv.name" class="border-b border-slate-100">
                        <td class="px-4 py-[11px] text-sm font-semibold text-slate-900 whitespace-nowrap">
                          {{ vv.name }}
                        </td>
                        <td class="px-3 py-[11px] text-[13px] text-slate-500 whitespace-nowrap">
                          {{ vv.skuLabel }}
                        </td>
                        <td class="px-3 py-[11px]">
                          <div class="flex flex-wrap gap-[5px]">
                            <span
                              v-for="ac in vv.attrChips"
                              :key="ac"
                              class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                            >{{ ac }}</span>
                          </div>
                        </td>
                        <td class="px-3 py-[11px] text-sm text-slate-700 whitespace-nowrap">
                          {{ vv.priceLabel }}
                        </td>
                        <td class="px-3 py-[11px] text-sm text-slate-700 whitespace-nowrap">
                          {{ vv.stockLabel }}
                        </td>
                        <td class="px-4 py-[11px] whitespace-nowrap">
                          <span :style="vv.statusBadgeStyle">{{ vv.statusLabel }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- BUNDLE -->
          <div v-if="isBundleProduct" class="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
              Bundle
            </h2>
            <p class="text-[13px] text-slate-500 mt-0 mb-4">
              Components and their products in this bundle.
            </p>
            <div v-if="bundleComponentRows.length" class="flex flex-col gap-4">
              <div
                v-for="(comp, ci) in bundleComponentRows"
                :key="ci"
                class="border border-slate-200 rounded-[10px] p-4 bg-slate-50"
              >
                <div class="text-sm font-bold text-slate-900 mb-3">
                  {{ comp.title }}
                </div>
                <div class="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))]">
                  <div
                    v-for="(prod, pi) in comp.products"
                    :key="pi"
                    class="border border-slate-200 rounded-lg bg-white px-3.5 py-3 flex items-center gap-2.5"
                  >
                    <div class="w-[34px] h-[34px] rounded-lg bg-emerald-50 text-green-600 flex items-center justify-center flex-shrink-0">
                      <UIcon name="i-lucide-package" class="w-[17px] h-[17px]" />
                    </div>
                    <div class="min-w-0">
                      <div class="text-[13.5px] font-semibold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">
                        {{ prod.name }}
                      </div>
                      <div class="text-xs text-slate-500">
                        {{ prod.sku }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-else
              class="border-[1.5px] border-dashed border-slate-200 rounded-[10px] px-6 py-10 text-center"
            >
              <div class="text-sm text-slate-400">
                No components in this bundle.
              </div>
            </div>
          </div>

          <!-- PRICING -->
          <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <div class="flex items-center justify-between mb-1">
              <h2 class="text-base font-bold text-slate-900 m-0">
                Pricing
              </h2>
            </div>
            <p class="text-[13px] text-slate-500 mt-0 mb-4">
              Pricing versions are managed independently of the page edit mode.
            </p>

            <div v-if="isEditMode">
              <div class="mb-5">
                <label class="field-label">Monthly Fee</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
                  <input
                    class="field-input pl-[26px]"
                    type="number"
                    :value="editMonthly"
                    placeholder="0.00"
                    @input="editMonthly = ($event.target as HTMLInputElement).value"
                  >
                </div>
              </div>
              <div class="mb-1">
                <div class="flex items-baseline gap-2 mb-2">
                  <label class="field-label mb-0">Initial Fee</label>
                  <span class="text-xs text-slate-400">sum of published components below.</span>
                </div>
                <div
                  v-if="feeComponentsLocked"
                  class="flex items-center gap-2 mb-2.5 text-[12.5px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                >
                  <UIcon name="i-lucide-lock" class="w-[13px] h-[13px] flex-shrink-0" />
                  <span>Components and publish states are set in Default scope. Override amounts for this platform here.</span>
                </div>
                <div class="border border-slate-200 rounded-[10px] overflow-hidden">
                  <div class="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border-b border-slate-200">
                    <span class="flex-1 min-w-0 text-xs font-bold text-slate-500 uppercase tracking-[0.03em]">Component</span>
                    <span class="w-[140px] flex-shrink-0 text-xs font-bold text-slate-500 uppercase tracking-[0.03em]">Amount</span>
                    <span class="w-[90px] flex-shrink-0 text-center text-xs font-bold text-slate-500 uppercase tracking-[0.03em]">Published</span>
                    <span class="w-[38px] flex-shrink-0" />
                  </div>
                  <div v-for="c in editInitialComponentRows" :key="c.index" :style="c.rowStyle">
                    <div class="flex-1 min-w-0">
                      <div
                        v-if="c.locked"
                        class="flex items-center gap-2 text-sm font-semibold text-slate-900"
                      >
                        {{ c.name }} <span class="text-[11px] font-semibold px-2 py-px rounded-full bg-blue-50 text-blue-600 border border-blue-200">Base</span>
                      </div>
                      <div v-else class="select-wrap">
                        <select
                          class="field-input"
                          :value="c.feeId"
                          :disabled="c.selectDisabled"
                          @change="onComponentSelect(c.index, ($event.target as HTMLSelectElement).value)"
                        >
                          <option value="">
                            Select component...
                          </option>
                          <option v-for="opt in c.options" :key="opt.id" :value="opt.id">
                            {{ opt.name }}
                          </option>
                        </select>
                      </div>
                    </div>
                    <div class="relative w-[140px] flex-shrink-0">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
                      <input
                        class="field-input pl-[26px]"
                        type="number"
                        :value="c.amount"
                        placeholder="0"
                        @input="onComponentAmount(c.index, ($event.target as HTMLInputElement).value)"
                      >
                    </div>
                    <div class="w-[90px] flex-shrink-0 flex justify-center">
                      <button
                        :disabled="c.publishLocked"
                        :title="c.publishTitle"
                        :style="c.publishTrackStyle"
                        @click="toggleComponentPublish(c.index)"
                      >
                        <span :style="c.publishKnobStyle" />
                      </button>
                    </div>
                    <div class="w-[38px] flex-shrink-0">
                      <button
                        v-if="c.canRemove"
                        title="Remove component"
                        class="btn-icon-hover border border-slate-200 bg-white text-red-500 w-[38px] h-[38px] rounded-lg cursor-pointer flex items-center justify-center"
                        @click="removeEditComponent(c.index)"
                      >
                        <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                      </button>
                      <span
                        v-else-if="c.locked"
                        class="w-[38px] h-[38px] inline-flex items-center justify-center text-slate-300"
                      >
                        <UIcon name="i-lucide-lock" class="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                  <div v-if="canAddEditComponent" class="px-3 py-2.5 border-b border-slate-100">
                    <button
                      class="inline-flex items-center gap-1.5 border border-dashed border-green-500 bg-emerald-50 text-green-600 text-[13px] font-semibold px-3.5 py-2 rounded-lg cursor-pointer"
                      @click="addEditComponent"
                    >
                      <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" /> Add component
                    </button>
                  </div>
                  <div class="flex items-center justify-between px-3.5 py-3 bg-slate-50">
                    <span class="text-sm font-bold text-slate-900">Initial Fee (Total)</span>
                    <span class="text-base font-bold text-slate-900">{{ editInitialTotalLabel }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="showPricingTable" class="border border-slate-200 rounded-[10px] overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full border-collapse min-w-[560px]">
                  <thead>
                    <tr class="bg-slate-50 border-b border-slate-200">
                      <th class="text-left text-xs font-bold text-slate-500 uppercase tracking-[0.03em] px-4 py-3">
                        Price Version
                      </th>
                      <th class="text-left text-xs font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-3">
                        Monthly Fee
                      </th>
                      <th class="text-left text-xs font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-3">
                        Initial Fee
                      </th>
                      <th class="text-left text-xs font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-3">
                        Status
                      </th>
                      <th v-if="isEditMode" class="text-left text-xs font-bold text-slate-500 uppercase tracking-[0.03em] px-4 py-3 w-[90px]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in pricingRows" :key="row.version" class="border-b border-slate-100">
                      <td class="px-4 py-3 text-sm font-semibold text-slate-900">
                        {{ row.version }}
                      </td>
                      <td class="px-3 py-3 text-sm text-slate-700">
                        {{ row.monthlyFeeLabel }}
                      </td>
                      <td class="px-3 py-3 text-sm text-slate-700">
                        {{ row.initialFeeLabel }}
                      </td>
                      <td class="px-3 py-3">
                        <span :style="row.statusBadgeStyle">{{ row.status }}</span>
                      </td>
                      <td v-if="isEditMode" class="px-4 py-3">
                        <button class="btn-icon-hover border border-slate-200 bg-white text-slate-700 w-8 h-8 rounded-lg cursor-pointer inline-flex items-center justify-center">
                          <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div
              v-if="showPricingEmpty"
              class="border-[1.5px] border-dashed border-slate-200 rounded-[10px] px-6 py-7 text-center text-[13px] text-slate-400"
            >
              No pricing versions yet.
            </div>
          </div>

          <!-- PER-PLATFORM SUMMARY -->
          <div v-if="showPlatformSummary" class="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
              Per-platform values
            </h2>
            <p class="text-[13px] text-slate-500 mt-0 mb-4">
              Effective name and price on each assigned platform.
            </p>
            <div class="border border-slate-200 rounded-[10px] overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full border-collapse min-w-[560px]">
                  <thead>
                    <tr class="bg-slate-50 border-b border-slate-200">
                      <th class="text-left text-xs font-bold text-slate-500 uppercase tracking-[0.03em] px-4 py-3">
                        Platform
                      </th>
                      <th class="text-left text-xs font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-3">
                        Name
                      </th>
                      <th class="text-left text-xs font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-3">
                        Monthly Price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in platformSummaryRows" :key="row.platform" class="border-b border-slate-100">
                      <td class="px-4 py-3 text-sm font-semibold text-slate-900 whitespace-nowrap">
                        <span class="inline-flex items-center gap-2"><UIcon name="i-lucide-globe" class="w-3.5 h-3.5 text-slate-400" />{{ row.platform }}</span>
                      </td>
                      <td class="px-3 py-3 text-sm text-slate-700">
                        <div class="flex items-center gap-2 flex-wrap">
                          {{ row.name }}<span :style="row.nameTagStyle">{{ row.nameTag }}</span>
                        </div>
                      </td>
                      <td class="px-3 py-3 text-sm text-slate-700">
                        <div class="flex items-center gap-2 flex-wrap">
                          {{ row.price }}<span :style="row.priceTagStyle">{{ row.priceTag }}</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="grow shrink basis-[320px]" aria-hidden="true" />
      </div>
    </div>

    <!-- cancel confirm -->
    <div
      v-if="cancelConfirmOpen"
      class="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center z-[100]"
    >
      <div class="bg-white rounded-[14px] w-[420px] max-w-[92vw] shadow-[0_20px_60px_rgba(0,0,0,0.25)] p-6">
        <h3 class="text-base font-bold text-slate-900 mt-0 mb-2">
          Discard changes?
        </h3>
        <p class="text-sm text-slate-500 mt-0 mb-5">
          Your edits will not be saved.
        </p>
        <div class="flex justify-end gap-2.5">
          <button
            class="border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-4 py-[9px] rounded-lg cursor-pointer"
            @click="onKeepEditing"
          >
            Keep Editing
          </button>
          <button
            class="border-none bg-red-600 text-white text-sm font-bold px-[18px] py-[9px] rounded-lg cursor-pointer"
            @click="onConfirmDiscard"
          >
            Discard
          </button>
        </div>
      </div>
    </div>

    <!-- delete confirm -->
    <div
      v-if="deleteConfirmOpen"
      class="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center z-[100]"
    >
      <div class="bg-white rounded-[14px] w-[440px] max-w-[92vw] shadow-[0_20px_60px_rgba(0,0,0,0.25)] p-6">
        <div class="flex items-center gap-2.5 mb-2">
          <div class="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0">
            <UIcon name="i-lucide-triangle-alert" class="w-[18px] h-[18px]" />
          </div>
          <h3 class="text-base font-bold text-slate-900 m-0">
            Delete {{ product.name }}?
          </h3>
        </div>
        <p class="text-sm text-slate-500 mt-0 mb-5">
          This action cannot be undone.
        </p>
        <div class="flex justify-end gap-2.5">
          <button
            class="border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-4 py-[9px] rounded-lg cursor-pointer"
            @click="onCancelDelete"
          >
            Cancel
          </button>
          <button
            class="border-none bg-red-600 text-white text-sm font-bold px-[18px] py-[9px] rounded-lg cursor-pointer"
            @click="onConfirmDelete"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- toast -->
    <div
      v-if="toastMessage"
      class="fixed top-6 right-6 bg-slate-900 text-white px-[18px] py-[13px] rounded-[10px] flex items-center gap-2.5 text-[13px] font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.25)] z-[200]"
    >
      <UIcon name="i-lucide-circle-check-big" class="w-4 h-4 text-green-500" />
      {{ toastMessage }}
    </div>
  </div>
</template>

<style scoped>
.field-input {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 14px;
  color: #0f172a;
  background: #fff;
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.field-input:focus {
  border-color: #00c16a;
  box-shadow: 0 0 0 3px rgba(0, 193, 106, 0.15);
}
.field-input.has-error {
  border-color: #fb2c36;
}
.field-input:disabled {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}
.field-input::placeholder {
  color: #94a3b8;
}
.field-label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 6px;
  display: block;
}
select.field-input {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 28px;
  background-color: #fff;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 16px 16px;
  cursor: pointer;
}
.select-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}
.select-wrap select {
  width: 100%;
}
.static-label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 5px;
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.static-value {
  font-size: 14px;
  color: #0f172a;
  font-weight: 500;
}
.btn-icon-hover:hover {
  background: #f1f5f9;
}
</style>
