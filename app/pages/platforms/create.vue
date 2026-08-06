<script setup lang="ts">
import type { Platform } from '~/types'

useHead({ title: 'Create Platform — Vertex' })

const route = useRoute()
const router = useRouter()

interface FormErrors { name?: string, code?: string, url?: string }

// ── state (mirrors the design's DCLogic state) ──
const editId = ref<string | null>(null)
const form = reactive({ name: '', code: '', url: '' })
const codeTouched = ref(false)
const dirty = ref(false)
const errors = ref<FormErrors>({})
const discardOpen = ref(false)

// SSR-safe: resolve the edit target from localStorage only after mount, so
// server + first client paint both render the empty "Create" form.
onMounted(() => {
  const rawId = route.query.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  if (id) {
    const existing = platformById(loadPlatforms(), id)
    if (existing) {
      editId.value = id
      form.name = existing.name
      form.code = existing.code
      form.url = existing.url
      codeTouched.value = true
    }
  }
})

const pageTitle = computed(() => editId.value ? 'Edit Platform' : 'Create Platform')
const codeLocked = computed(() => !!editId.value)

function set(field: 'name' | 'code' | 'url', value: string) {
  form[field] = value
  errors.value = { ...errors.value, [field]: undefined }
  if (field === 'name' && !codeTouched.value && !editId.value) {
    form.code = platformSlug(value)
  }
  dirty.value = true
}
function onNameInput(e: Event) {
  set('name', (e.target as HTMLInputElement).value)
}
function onCodeInput(e: Event) {
  codeTouched.value = true
  set('code', platformSlug((e.target as HTMLInputElement).value))
}
function onUrlInput(e: Event) {
  set('url', (e.target as HTMLInputElement).value)
}

function validate(): FormErrors {
  const f = form
  const errs: FormErrors = {}
  if (!f.name || !f.name.trim()) errs.name = 'Name is required.'
  if (!f.code || !f.code.trim()) {
    errs.code = 'Code is required.'
  } else {
    const dup = loadPlatforms().find(p => p.code === f.code.trim() && p.id !== editId.value)
    if (dup) errs.code = 'This code is already in use.'
  }
  if (!f.url || !f.url.trim()) errs.url = 'URL / Path is required.'
  return errs
}

function save() {
  const errs = validate()
  if (Object.keys(errs).length) {
    errors.value = errs
    return
  }
  const f = form
  const list = loadPlatforms()
  let next: Platform[]
  if (editId.value) {
    next = list.map(p => p.id === editId.value ? { ...p, name: f.name.trim(), url: f.url.trim() } : p)
  } else {
    next = [...list, { id: 'plat_' + Date.now(), name: f.name.trim(), code: f.code.trim(), url: f.url.trim() }]
  }
  savePlatforms(next)
  try {
    sessionStorage.setItem('vertex_platform_toast', editId.value ? 'Platform updated successfully' : 'Platform created successfully')
  } catch {
    // ignore
  }
  dirty.value = false
  router.push('/platforms')
}

function onLeave() {
  if (dirty.value) discardOpen.value = true
  else router.push('/platforms')
}
function onConfirmDiscard() {
  router.push('/platforms')
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
      <span class="text-slate-900 font-semibold">{{ pageTitle }}</span>
    </div>

    <div class="flex items-center gap-3 mb-6">
      <button
        class="btn-icon-hover w-[38px] h-[38px] border border-slate-200 bg-white rounded-lg inline-flex items-center justify-center text-slate-700 flex-shrink-0 cursor-pointer"
        @click="onLeave"
      >
        <UIcon name="i-lucide-arrow-left" class="w-[18px] h-[18px]" />
      </button>
      <h1 class="text-2xl font-bold text-slate-900 m-0">
        {{ pageTitle }}
      </h1>
    </div>

    <div>
      <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h2 class="text-[17px] font-bold text-slate-900 mt-0 mb-1">
          Platform Information
        </h2>
        <p class="text-sm text-slate-500 mt-0 mb-5">
          A sales channel under Vertex Digital Marketing.
        </p>

        <div class="mb-[18px]">
          <label class="field-label">Name <span class="text-red-600">*</span></label>
          <input
            class="field-input"
            :class="{ err: errors.name }"
            type="text"
            :value="form.name"
            placeholder="e.g. SIM Point"
            @input="onNameInput"
          >
          <div v-if="errors.name" class="text-[13px] text-red-600 mt-1.5">
            {{ errors.name }}
          </div>
        </div>

        <div class="mb-[18px]">
          <label class="field-label">Code <span class="text-red-600">*</span></label>
          <input
            class="field-input font-mono"
            :class="{ err: errors.code }"
            type="text"
            :value="form.code"
            :disabled="codeLocked"
            placeholder="e.g. sim_point"
            @input="onCodeInput"
          >
          <div v-if="errors.code" class="text-[13px] text-red-600 mt-1.5">
            {{ errors.code }}
          </div>
          <div v-else-if="!editId" class="text-[13px] text-slate-400 mt-1.5">
            Lowercase identifier, auto-filled from the name. Editable before saving; locked after creation.
          </div>
        </div>

        <div>
          <label class="field-label">URL / Path <span class="text-red-600">*</span></label>
          <input
            class="field-input"
            :class="{ err: errors.url }"
            type="text"
            :value="form.url"
            placeholder="e.g. vdm.com/sp-sim"
            @input="onUrlInput"
          >
          <div v-if="errors.url" class="text-[13px] text-red-600 mt-1.5">
            {{ errors.url }}
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2.5 mt-5">
        <button
          class="border border-slate-200 bg-white text-slate-700 text-[15px] font-semibold px-5 py-2.5 rounded-lg cursor-pointer"
          @click="onLeave"
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
            @click="onConfirmDiscard"
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
.field-input.err {
  border-color: #dc2626;
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
</style>
