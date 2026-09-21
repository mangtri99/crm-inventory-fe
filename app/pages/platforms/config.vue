<script setup lang="ts">
import type { ConfigValue, ConfigValues, Platform } from '~/types'

useHead({ title: 'Edit Platform — Vertex' })

const route = useRoute()
const router = useRouter()

// ── platform + identity ──
const platforms = ref<Platform[]>(PLATFORM_SEED)

const platform = computed<Platform | null>(() => {
  const id = typeof route.query.id === 'string' ? route.query.id : ''
  return (id ? platformById(platforms.value, id) : null) || platforms.value[0] || null
})

const identity = reactive({ name: '', code: '', url: '' })
const cfg = ref<ConfigValues>({})
const errors = reactive<{ name: string, url: string }>({ name: '', url: '' })
const dirty = ref(false)
const discardOpen = ref(false)
const openGroups = reactive<Record<string, boolean>>({ store: true, web: true, contact: true, contactus: true })

// Seed identity + config from whatever platform the route resolves to.
function hydrate() {
  const p = platform.value
  identity.name = p ? p.name : ''
  identity.code = p ? p.code : ''
  identity.url = p ? p.url : ''
  cfg.value = p ? loadPlatformConfig(p.id) : { ...GENERIC_CONFIG_SEED }
}

hydrate()

onMounted(() => {
  platforms.value = loadPlatforms()
  hydrate()
  dirty.value = false
})

function setCfg(key: string, value: ConfigValue) {
  cfg.value = { ...cfg.value, [key]: value }
  dirty.value = true
}
function setIdentity(field: 'name' | 'url', value: string) {
  identity[field] = value
  errors[field] = ''
  dirty.value = true
}

// ── collapsible groups ──
interface FieldView {
  key: string
  label: string
  isToggle: boolean
  isTextarea: boolean
  isText: boolean
  placeholder: string
  value: string
  on: boolean
  locked: boolean
  showBadge: boolean
  badgeLabel: string
  hint: string
}

const groups = computed(() => CONFIG_GROUPS.map(def => ({
  group: def.group,
  title: def.title,
  icon: 'i-lucide-' + def.icon,
  open: !!openGroups[def.group],
  fields: def.fields.map<FieldView>((fd) => {
    // Base URL is the single source of truth = the identity URL / Path.
    if (fd.synced) {
      return {
        key: fd.key,
        label: fd.label,
        isToggle: false,
        isTextarea: false,
        isText: true,
        placeholder: fd.placeholder || '',
        value: identity.url || '',
        on: false,
        locked: true,
        showBadge: true,
        badgeLabel: 'Synced',
        hint: 'Synced with URL / Path above — edit it there.'
      }
    }
    const val = cfg.value[fd.key]
    return {
      key: fd.key,
      label: fd.label,
      isToggle: fd.type === 'toggle',
      isTextarea: fd.type === 'textarea',
      isText: fd.type === 'text',
      placeholder: fd.placeholder || '',
      value: fd.type === 'toggle' ? '' : (val == null ? '' : String(val)),
      on: !!val,
      locked: false,
      showBadge: false,
      badgeLabel: '',
      hint: ''
    }
  })
})))

function toggleGroup(group: string) {
  openGroups[group] = !openGroups[group]
}

// ── save ──
function save() {
  errors.name = identity.name.trim() ? '' : 'Name is required.'
  errors.url = identity.url.trim() ? '' : 'URL / Path is required.'
  if (errors.name || errors.url) return

  const p = platform.value
  if (p) {
    savePlatforms(loadPlatforms().map(x => x.id === p.id
      ? { ...x, name: identity.name.trim(), url: identity.url.trim() }
      : x))
    savePlatformConfig(p.id, { ...cfg.value, baseUrl: identity.url.trim() })
  }
  try {
    sessionStorage.setItem('vertex_platform_toast', identity.name.trim() + ' updated')
  } catch {
    // sessionStorage unavailable
  }
  dirty.value = false
  return router.push('/platforms')
}

// ── leave guard ──
function tryLeave() {
  if (dirty.value) {
    discardOpen.value = true
    return
  }
  return router.push('/platforms')
}

const pageTitle = computed(() => 'Edit Platform — ' + (platform.value ? platform.value.name : 'Platform'))
const crumbLast = computed(() => platform.value ? platform.value.name : 'Platform')

function switchTrackClass(on: boolean) {
  return on ? 'bg-green-500' : 'bg-slate-200'
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
      <span class="text-slate-900 font-semibold">{{ crumbLast }}</span>
    </div>

    <div class="flex items-center gap-3 mb-2">
      <button
        title="Back to platforms"
        class="btn-icon-hover w-[38px] h-[38px] border border-slate-200 bg-white rounded-lg inline-flex items-center justify-center text-slate-700 flex-shrink-0 cursor-pointer"
        @click="tryLeave"
      >
        <UIcon name="i-lucide-arrow-left" class="w-[18px] h-[18px]" />
      </button>
      <h1 class="text-2xl font-bold text-slate-900 m-0">
        {{ pageTitle }}
      </h1>
    </div>
    <p class="text-[15px] text-slate-500 mt-0 mb-6 pl-[50px]">
      Identity and configuration for this platform. Each platform holds its own values.
    </p>

    <!-- IDENTITY -->
    <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-4">
      <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
        Platform Information
      </h2>
      <p class="text-[13px] text-slate-500 mt-0 mb-5">
        Identity for this sales channel.
      </p>

      <div class="mb-[18px]">
        <label class="field-label">Name <span class="text-red-600">*</span></label>
        <input
          :value="identity.name"
          type="text"
          class="field-input"
          :class="errors.name ? 'err' : ''"
          placeholder="e.g. SIM Point"
          @input="setIdentity('name', ($event.target as HTMLInputElement).value)"
        >
        <div v-if="errors.name" class="text-[13px] text-red-600 mt-1.5">
          {{ errors.name }}
        </div>
      </div>

      <div class="mb-[18px]">
        <label class="field-label">Code <span class="text-red-600">*</span></label>
        <input
          :value="identity.code"
          type="text"
          disabled
          class="field-input font-mono"
          placeholder="e.g. sim_point"
        >
        <div class="text-[13px] text-slate-400 mt-1.5">
          Locked — the code can't change after creation.
        </div>
      </div>

      <div>
        <label class="field-label">URL / Path <span class="text-red-600">*</span></label>
        <input
          :value="identity.url"
          type="text"
          class="field-input"
          :class="errors.url ? 'err' : ''"
          placeholder="e.g. vdm.com/sp-sim"
          @input="setIdentity('url', ($event.target as HTMLInputElement).value)"
        >
        <div v-if="errors.url" class="text-[13px] text-red-600 mt-1.5">
          {{ errors.url }}
        </div>
      </div>
    </div>

    <!-- CONFIG GROUPS -->
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
            <UIcon :name="g.icon" class="w-[17px] h-[17px] text-green-600" />
            <span class="text-base font-bold text-slate-900">{{ g.title }}</span>
          </div>
          <span
            class="inline-flex transition-transform duration-150"
            :class="g.open ? 'rotate-180' : ''"
          >
            <UIcon name="i-lucide-chevron-down" class="w-[18px] h-[18px] text-slate-400" />
          </span>
        </button>

        <div v-if="g.open" class="px-5 pt-1 pb-5 flex flex-col gap-[18px] border-t border-slate-100">
          <div v-for="f in g.fields" :key="f.key">
            <div class="flex items-center justify-between gap-3 mb-1.5">
              <label class="field-label mb-0">{{ f.label }}</label>
              <span
                v-if="f.showBadge"
                class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200"
              >{{ f.badgeLabel }}</span>
            </div>

            <button
              v-if="f.isToggle"
              class="w-10 h-[22px] rounded-full border-none cursor-pointer relative p-0.5 inline-flex items-center transition-colors"
              :class="switchTrackClass(f.on)"
              @click="setCfg(f.key, !f.on)"
            >
              <span
                class="w-[18px] h-[18px] rounded-full bg-white block shadow-sm transition-transform duration-150"
                :class="f.on ? 'translate-x-[18px]' : 'translate-x-0'"
              />
            </button>

            <textarea
              v-else-if="f.isTextarea"
              :value="f.value"
              rows="3"
              class="field-input resize-y"
              :disabled="f.locked"
              :placeholder="f.placeholder"
              @change="setCfg(f.key, ($event.target as HTMLTextAreaElement).value)"
            />

            <input
              v-else
              :value="f.value"
              type="text"
              class="field-input"
              :disabled="f.locked"
              :placeholder="f.placeholder"
              @change="setCfg(f.key, ($event.target as HTMLInputElement).value)"
            >

            <div v-if="f.hint" class="text-[12.5px] text-slate-400 mt-1.5 flex items-center gap-[5px]">
              <UIcon name="i-lucide-info" class="w-3 h-3 flex-shrink-0" />{{ f.hint }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-2.5 mt-5">
      <button
        class="border border-slate-200 bg-white text-slate-700 text-[15px] font-semibold px-5 py-2.5 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
        @click="tryLeave"
      >
        Cancel
      </button>
      <button
        class="border-none bg-green-500 text-white text-[15px] font-bold px-[22px] py-2.5 rounded-lg cursor-pointer shadow-sm hover:bg-green-600 transition-colors"
        @click="save"
      >
        Save Platform
      </button>
    </div>

    <!-- discard confirm -->
    <div
      v-if="discardOpen"
      class="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center z-[200] p-5"
    >
      <div class="bg-white rounded-[14px] w-[420px] max-w-[92vw] shadow-[0_20px_60px_rgba(0,0,0,0.25)] p-6">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-11 h-11 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <UIcon name="i-lucide-triangle-alert" class="w-[22px] h-[22px]" />
          </div>
          <h3 class="text-[17px] font-bold text-slate-900 m-0">
            Discard changes?
          </h3>
        </div>
        <p class="text-[15px] text-slate-500 mt-0 mb-5">
          Any information you entered will be lost.
        </p>
        <div class="flex justify-end gap-2.5">
          <button
            class="border border-slate-200 bg-white text-slate-700 text-[15px] font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer"
            @click="discardOpen = false"
          >
            Keep editing
          </button>
          <button
            class="border-none bg-red-600 text-white text-[15px] font-bold px-[18px] py-[9px] rounded-lg cursor-pointer"
            @click="router.push('/platforms')"
          >
            Discard
          </button>
        </div>
      </div>
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
.field-input.err {
  border-color: #dc2626;
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
</style>
