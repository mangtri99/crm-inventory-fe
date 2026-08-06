<script setup lang="ts">
import type { ConfigOverrides, ConfigValue, Platform } from '~/types'

useHead({ title: 'Platform Configuration — Vertex' })

const route = useRoute()

// ── state (mirrors the design's DCLogic state) ──
const platform = ref<Platform | null>(null)
const platformId = ref<string | null>(null)
const overrides = ref<ConfigOverrides>({})
const defaults = ref(reactive({ ...CONFIG_DEFAULT_SEED }))
const openGroups = reactive<Record<string, boolean>>({ store: true, web: true, contact: true, contactus: true })
const toast = ref<string | null>(null)

let toastTimer: number | null = null

// SSR-safe: platform + stored config resolved after mount; server + first
// client paint render the deterministic seed with no platform selected.
onMounted(() => {
  const rawId = route.query.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const list = loadPlatforms()
  const found = id ? platformById(list, id) : null
  const plat = found || list[0] || null
  platform.value = plat
  platformId.value = plat ? plat.id : (id || null)
  defaults.value = reactive(loadConfigDefaults())
  overrides.value = platformId.value ? loadConfigOverrides(platformId.value) : {}
})
onBeforeUnmount(() => {
  if (toastTimer !== null) clearTimeout(toastTimer)
})

function setField(key: string, patch: Partial<{ override: boolean, value: ConfigValue }>) {
  const cur = { ...overrides.value }
  cur[key] = { override: false, value: '', ...(cur[key] || {}), ...patch }
  overrides.value = cur
}

function switchTrack(on: boolean, locked: boolean) {
  return `width:40px;height:22px;border-radius:999px;border:none;cursor:${locked ? 'not-allowed' : 'pointer'};background:${on ? '#00c16a' : '#e2e8f0'};position:relative;padding:2px;display:inline-flex;align-items:center;opacity:${locked ? '0.6' : '1'};transition:background 150ms ease;`
}
function switchKnob(on: boolean) {
  return `width:18px;height:18px;border-radius:999px;background:#fff;display:block;box-shadow:0 1px 2px rgba(0,0,0,0.15);transform:translateX(${on ? '18px' : '0'});transition:transform 150ms ease;`
}

const platformName = computed(() => platform.value ? platform.value.name : 'Platform')
const platformCode = computed(() => platform.value ? platform.value.code : '')
const platformUrl = computed(() => platform.value ? platform.value.url : '')

interface FieldVM {
  key: string
  label: string
  isToggle: boolean
  isTextarea: boolean
  isText: boolean
  placeholder: string
  value: string
  toggleOn: boolean
  locked: boolean
  useDefault: boolean
  badgeLabel: string
  badgeStyle: string
  subText: string
  switchTrackStyle: string
  switchKnobStyle: string
  effective: ConfigValue
}

const groups = computed(() =>
  CONFIG_GROUPS.map((def) => {
    const open = !!openGroups[def.group]
    let overrideCount = 0
    const fields: FieldVM[] = def.fields.map((fd) => {
      const rec = overrides.value[fd.key] || { override: false, value: '' }
      const override = !!rec.override
      if (override) overrideCount++
      const dVal = defaults.value[fd.key]
      const inheritedShown = (fd.synced && platform.value) ? platform.value.url : dVal
      const effective: ConfigValue = override ? rec.value : (inheritedShown ?? '')
      return {
        key: fd.key,
        label: fd.label,
        isToggle: fd.type === 'toggle',
        isTextarea: fd.type === 'textarea',
        isText: fd.type === 'text',
        placeholder: fd.placeholder || '',
        value: fd.type === 'toggle' ? '' : String(effective ?? ''),
        toggleOn: !!effective,
        locked: !override,
        useDefault: !override,
        badgeLabel: override ? 'Overridden' : 'Inherited',
        badgeStyle: 'font-size:11px;font-weight:600;padding:2px 9px;border-radius:999px;' + (override
          ? 'background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;'
          : 'background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;'),
        subText: fd.synced
          ? (override ? 'Saving replaces this platform’s URL/Path.' : 'Inherited — uses this platform’s URL/Path.')
          : (override ? 'Platform-specific value.' : 'From Default: ' + (fd.type === 'toggle' ? (dVal ? 'Enabled' : 'Disabled') : (String(dVal || '') || '—'))),
        switchTrackStyle: switchTrack(!!effective, !override),
        switchKnobStyle: switchKnob(!!effective),
        effective
      }
    })
    return {
      group: def.group,
      title: def.title,
      icon: def.icon,
      open,
      hasOverrides: overrideCount > 0,
      overrideCount: overrideCount + ' overridden',
      chevronStyle: `display:inline-flex;transition:transform 150ms ease;transform:rotate(${open ? '180deg' : '0deg'});`,
      fields
    }
  })
)

function toggleGroup(group: string) {
  openGroups[group] = !openGroups[group]
}
function onToggleUseDefault(f: FieldVM, e: Event) {
  if ((e.target as HTMLInputElement).checked) setField(f.key, { override: false })
  else setField(f.key, { override: true, value: f.effective })
}
function onFieldChange(f: FieldVM, e: Event) {
  setField(f.key, { override: true, value: (e.target as HTMLInputElement | HTMLTextAreaElement).value })
}
function onToggleValue(f: FieldVM) {
  if (!f.locked) setField(f.key, { value: !f.effective })
}

function save() {
  const pid = platformId.value
  if (pid) saveConfigOverrides(pid, overrides.value)
  // Base URL sync: an overridden Base URL becomes this platform's URL/Path
  const bu = overrides.value.baseUrl
  if (bu && bu.override && platform.value) {
    const next = loadPlatforms().map(p => p.id === platform.value!.id ? { ...p, url: String(bu.value) } : p)
    savePlatforms(next)
    platform.value = { ...platform.value, url: String(bu.value) }
  }
  if (toastTimer !== null) clearTimeout(toastTimer)
  toast.value = 'Configuration saved for ' + (platform.value ? platform.value.name : 'platform')
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2600)
}
</script>

<template>
  <div class="flex-1 min-w-0 px-8 pt-7 pb-20">
    <div class="text-[13px] text-slate-500 mb-3.5">
      <NuxtLink to="/dashboard" class="text-green-600 no-underline hover:text-green-700">
        Inventory
      </NuxtLink> <span class="text-slate-300">/</span>
      <NuxtLink to="/platforms" class="text-green-600 no-underline hover:text-green-700">
        Platforms
      </NuxtLink> <span class="text-slate-300">/</span>
      <span class="text-slate-700">{{ platformName }}</span> <span class="text-slate-300">/</span>
      <span class="text-slate-900 font-semibold">Configuration</span>
    </div>

    <div class="flex items-center gap-3 mb-2 flex-wrap">
      <NuxtLink
        to="/platforms"
        class="btn-icon-hover w-[38px] h-[38px] border border-slate-200 bg-white rounded-lg inline-flex items-center justify-center text-slate-700 flex-shrink-0 no-underline"
      >
        <UIcon name="i-lucide-arrow-left" class="w-[18px] h-[18px]" />
      </NuxtLink>
      <div class="w-[34px] h-[34px] rounded-lg bg-emerald-50 text-green-600 flex items-center justify-center flex-shrink-0">
        <UIcon name="i-lucide-globe" class="w-[18px] h-[18px]" />
      </div>
      <h1 class="text-2xl font-bold text-slate-900 m-0 whitespace-nowrap">
        Configure {{ platformName }}
      </h1>
      <span class="font-mono text-[13px] text-slate-600 bg-slate-100 border border-slate-200 rounded-md px-2 py-[3px]">{{ platformCode }}</span>
      <span class="text-sm text-slate-500">{{ platformUrl }}</span>
    </div>
    <p class="text-[15px] text-slate-500 mt-0 mb-5 pl-[50px]">
      Each field inherits the Default value. Uncheck “Use Default” to set a value just for this platform.
    </p>

    <div class="flex items-center gap-2.5 mb-5 text-[13px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-[9px]">
      <UIcon name="i-lucide-info" class="w-[15px] h-[15px] text-green-600 flex-shrink-0" />
      <span>Base values live on the <NuxtLink to="/platforms/configuration" class="text-green-600 no-underline hover:text-green-700">Configuration</NuxtLink> page (Default scope). This page stores only this platform’s overrides.</span>
    </div>

    <div class="flex flex-col gap-4">
      <div
        v-for="g in groups"
        :key="g.group"
        class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
      >
        <button
          type="button"
          class="w-full flex items-center justify-between gap-3 px-5 py-4 bg-white border-none cursor-pointer text-left"
          @click="toggleGroup(g.group)"
        >
          <div class="flex items-center gap-2.5">
            <UIcon :name="'i-lucide-' + g.icon" class="w-[17px] h-[17px] text-green-600" />
            <span class="text-base font-bold text-slate-900">{{ g.title }}</span>
            <span
              v-if="g.hasOverrides"
              class="text-[11px] font-semibold px-[9px] py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
            >{{ g.overrideCount }}</span>
          </div>
          <span :style="g.chevronStyle"><UIcon name="i-lucide-chevron-down" class="w-[18px] h-[18px] text-slate-400" /></span>
        </button>
        <div v-if="g.open" class="px-5 pt-1 pb-5 flex flex-col gap-[18px] border-t border-slate-100">
          <div v-for="f in g.fields" :key="f.key">
            <div class="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
              <label class="field-label mb-0">{{ f.label }}</label>
              <div class="flex items-center gap-2.5">
                <span :style="f.badgeStyle">{{ f.badgeLabel }}</span>
                <label class="inline-flex items-center gap-1.5 text-[13px] text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    :checked="f.useDefault"
                    class="w-[15px] h-[15px] cursor-pointer accent-green-500"
                    @change="onToggleUseDefault(f, $event)"
                  >
                  Use Default
                </label>
              </div>
            </div>
            <button
              v-if="f.isToggle"
              :disabled="f.locked"
              :style="f.switchTrackStyle"
              @click="onToggleValue(f)"
            >
              <span :style="f.switchKnobStyle" />
            </button>
            <textarea
              v-else-if="f.isTextarea"
              class="field-input resize-y"
              rows="3"
              :value="f.value"
              :disabled="f.locked"
              :placeholder="f.placeholder"
              @change="onFieldChange(f, $event)"
            />
            <input
              v-else
              class="field-input"
              type="text"
              :value="f.value"
              :disabled="f.locked"
              :placeholder="f.placeholder"
              @change="onFieldChange(f, $event)"
            >
            <div class="text-[12.5px] text-slate-400 mt-1.5 flex items-center gap-[5px]">
              <UIcon name="i-lucide-corner-down-right" class="w-3 h-3 flex-shrink-0" />{{ f.subText }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-2.5 mt-5">
      <NuxtLink
        to="/platforms"
        class="border border-slate-200 bg-white text-slate-700 text-[15px] font-semibold px-5 py-2.5 rounded-lg cursor-pointer no-underline"
      >
        Cancel
      </NuxtLink>
      <button
        class="border-none bg-green-500 text-white text-[15px] font-bold px-[22px] py-2.5 rounded-lg cursor-pointer shadow-sm hover:bg-green-600 transition-colors"
        @click="save"
      >
        Save
      </button>
    </div>

    <!-- toast -->
    <div
      v-if="toast"
      class="toast-in fixed bottom-6 right-6 z-[300] bg-white border border-slate-200 border-l-4 border-l-green-500 rounded-[10px] shadow-[0_10px_30px_rgba(0,0,0,0.14)] px-[18px] py-3.5 flex items-center gap-3"
    >
      <UIcon name="i-lucide-circle-check" class="w-5 h-5 text-green-600" />
      <span class="text-[15px] font-semibold text-slate-900">{{ toast }}</span>
    </div>
  </div>
</template>

<style scoped>
.field-input {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 15px;
  color: #0f172a;
  background: #fff;
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.field-input:focus {
  border-color: #00c16a;
  box-shadow: 0 0 0 3px rgba(0, 193, 106, 0.15);
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
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 6px;
  display: block;
}
.btn-icon-hover:hover {
  background: #f1f5f9;
}
.toast-in {
  animation: toastIn 200ms ease;
}
@keyframes toastIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
