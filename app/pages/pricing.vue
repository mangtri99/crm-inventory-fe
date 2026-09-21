<script setup lang="ts">
import type { Fee } from '~/types'

useHead({ title: 'Pricing Setting — Vertex' })

interface ModalState {
  id: string | null
  name: string
  desc: string
  icon: string
  error: string
}

// fallback icon per seeded component id (rows saved before the picker existed)
const ICONS: Record<string, string> = {
  fee_base: 'anchor',
  fee_tax: 'receipt',
  fee_shipping: 'truck',
  fee_handling: 'package',
  fee_insurance: 'shield-check'
}
const DEFAULT_ICON = 'circle-dollar-sign'
const ICON_CHOICES = [
  'circle-dollar-sign', 'receipt', 'truck', 'package',
  'shield-check', 'tag', 'percent', 'coins',
  'wallet', 'credit-card', 'gift', 'wrench',
  'box', 'banknote', 'hand-coins', 'badge-percent'
]

// ── state (mirrors the design's DCLogic state) ──
const fees = ref<Fee[]>([...FEE_SEED])
const modal = ref<ModalState | null>(null)
const deleteTarget = ref<Fee | null>(null)
const toast = ref<string | null>(null)

let toastTimer: number | null = null

onMounted(() => {
  fees.value = loadFees()
})
onBeforeUnmount(() => {
  if (toastTimer !== null) clearTimeout(toastTimer)
})

function showToast(msg: string) {
  toast.value = msg
  if (toastTimer !== null) clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2800)
}

function iconOf(f: Fee) {
  return f.icon || ICONS[f.id] || DEFAULT_ICON
}
function iconChoiceStyle(selected: boolean) {
  return `width:42px;height:42px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;background:${selected ? '#ecfdf5' : '#fff'};border:1px solid ${selected ? '#00c16a' : '#e2e8f0'};color:${selected ? '#00a155' : '#64748b'};`
}
function pickIcon(name: string) {
  if (modal.value) modal.value = { ...modal.value, icon: name }
}
function editStyleOf(system: boolean) {
  return 'display:inline-flex;align-items:center;gap:6px;border:1px solid #e2e8f0;background:#fff;color:' + (system ? '#cbd5e1' : '#334155') + ';font-size:14px;font-weight:600;padding:7px 14px;border-radius:8px;cursor:' + (system ? 'not-allowed' : 'pointer') + ';'
}

// ── create / edit ──
function onCreate() {
  modal.value = { id: null, name: '', desc: '', icon: DEFAULT_ICON, error: '' }
}
function onEdit(f: Fee) {
  if (f.system) return
  modal.value = { id: f.id, name: f.name, desc: f.description || '', icon: iconOf(f), error: '' }
}
const saveDisabled = computed(() => !(modal.value && modal.value.name.trim()))
function saveModal() {
  const m = modal.value
  if (!m) return
  const name = (m.name || '').trim()
  if (!name) {
    modal.value = { ...m, error: 'Component name is required.' }
    return
  }
  const dup = fees.value.some(f => f.name.toLowerCase() === name.toLowerCase() && f.id !== m.id)
  if (dup) {
    modal.value = { ...m, error: 'A component with this name already exists.' }
    return
  }
  const next = m.id
    ? fees.value.map(f => f.id === m.id ? { ...f, name, description: m.desc, icon: m.icon } : f)
    : [...fees.value, { id: 'fee_' + Date.now(), name, description: m.desc, icon: m.icon || DEFAULT_ICON, system: false }]
  saveFees(next)
  fees.value = next
  modal.value = null
  showToast(m.id ? 'Component updated' : 'Component created')
}

// ── delete ──
const deleteUsage = computed(() => deleteTarget.value ? feeUsageCount(deleteTarget.value.id) : 0)
const deleteBlocked = computed(() => deleteUsage.value > 0)
function confirmDelete() {
  const t = deleteTarget.value
  if (!t || t.system || deleteBlocked.value) return
  const next = fees.value.filter(f => f.id !== t.id)
  saveFees(next)
  fees.value = next
  deleteTarget.value = null
  showToast('Component deleted')
}
const deleteIcon = computed(() => deleteBlocked.value ? 'shield-alert' : 'trash-2')
const deleteIconWrapStyle = computed(() =>
  'width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:' + (deleteBlocked.value ? '#fffbeb' : '#fef2f2') + ';color:' + (deleteBlocked.value ? '#d97706' : '#dc2626') + ';'
)
const deleteTitle = computed(() => {
  const t = deleteTarget.value
  if (!t) return ''
  return deleteBlocked.value ? 'Cannot delete component' : 'Delete ' + t.name + '?'
})
const deleteMessage = computed(() => {
  if (!deleteTarget.value) return ''
  if (!deleteBlocked.value) return 'This action cannot be undone.'
  const u = deleteUsage.value
  return `This component is used by ${u} product${u === 1 ? '' : 's'}. Remove it from them first.`
})
const deleteCancelLabel = computed(() => deleteBlocked.value ? 'Close' : 'Cancel')
</script>

<template>
  <div class="flex-1 min-w-0 px-8 pt-7 pb-20">
    <div class="text-[13px] text-slate-500 mb-3.5">
      <NuxtLink to="/dashboard" class="text-green-600 no-underline hover:text-green-700">
        Inventory
      </NuxtLink> <span class="text-slate-300">/</span>
      <NuxtLink to="/dashboard" class="text-green-600 no-underline hover:text-green-700">
        Product
      </NuxtLink> <span class="text-slate-300">/</span>
      <span class="text-green-600">Configuration</span> <span class="text-slate-300">/</span>
      <span class="text-slate-900 font-semibold">Pricing Setting</span>
    </div>

    <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 mt-0 mb-1">
          Pricing Setting
        </h1>
        <p class="text-[15px] text-slate-500 m-0">
          Reusable Initial Fee line-items used across product pricing.
        </p>
      </div>
      <button
        class="border-none bg-green-500 text-white text-[15px] font-bold px-[18px] py-2.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5 shadow-sm hover:bg-green-600 transition-colors"
        @click="onCreate"
      >
        <UIcon name="i-lucide-plus" class="w-[15px] h-[15px]" /> Create Component
      </button>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full border-collapse min-w-[560px]">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-5 py-[13px]">
                Component Name
              </th>
              <th class="text-right text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-5 py-[13px] w-[130px]">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in fees" :key="f.id" class="row-hover border-b border-slate-100">
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-2.5">
                  <div class="w-[34px] h-[34px] rounded-lg bg-emerald-50 text-green-600 flex items-center justify-center flex-shrink-0">
                    <UIcon :name="'i-lucide-' + iconOf(f)" class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-base font-semibold text-slate-900">{{ f.name }}</span>
                      <span
                        v-if="f.system"
                        class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200"
                      >Default</span>
                    </div>
                    <div v-if="f.description" class="text-[13px] text-slate-400 mt-0.5">
                      {{ f.description }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-5 py-3.5">
                <div class="flex items-center justify-end gap-2">
                  <button
                    :disabled="f.system"
                    class="btn-icon-hover"
                    :style="editStyleOf(f.system)"
                    @click="onEdit(f)"
                  >
                    <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    v-if="!f.system"
                    title="Delete component"
                    class="btn-icon-hover border border-slate-200 bg-white text-red-600 w-[34px] h-[34px] rounded-lg cursor-pointer inline-flex items-center justify-center"
                    @click="deleteTarget = f"
                  >
                    <UIcon name="i-lucide-trash-2" class="w-[15px] h-[15px]" />
                  </button>
                  <span
                    v-else
                    title="System component — locked"
                    class="w-[34px] h-[34px] rounded-lg inline-flex items-center justify-center text-slate-300"
                  >
                    <UIcon name="i-lucide-lock" class="w-[15px] h-[15px]" />
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- create / edit modal -->
    <div
      v-if="modal"
      class="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center z-[200] p-5"
    >
      <div class="bg-white rounded-[14px] w-[480px] max-w-[94vw] shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h3 class="text-[17px] font-bold text-slate-900 m-0">
            {{ modal.id ? 'Edit Component' : 'Create Component' }}
          </h3>
          <button
            class="btn-icon-hover border-none bg-transparent text-slate-500 w-8 h-8 rounded-lg cursor-pointer flex items-center justify-center"
            @click="modal = null"
          >
            <UIcon name="i-lucide-x" class="w-[18px] h-[18px]" />
          </button>
        </div>
        <div class="p-6">
          <div class="mb-[18px]">
            <label class="field-label">Component Name <span class="text-red-600">*</span></label>
            <input
              class="field-input"
              type="text"
              :value="modal.name"
              placeholder="e.g. Handling"
              @input="modal.name = ($event.target as HTMLInputElement).value; modal.error = ''"
            >
            <div v-if="modal.error" class="text-[13px] text-red-600 mt-1.5">
              {{ modal.error }}
            </div>
          </div>
          <div class="mb-[18px]">
            <label class="field-label">Icon</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="ic in ICON_CHOICES"
                :key="ic"
                type="button"
                :title="ic"
                :style="iconChoiceStyle(modal.icon === ic)"
                @click="pickIcon(ic)"
              >
                <UIcon :name="'i-lucide-' + ic" class="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
          <div>
            <label class="field-label">Description <span class="text-slate-400 font-normal">(optional)</span></label>
            <input
              class="field-input"
              type="text"
              :value="modal.desc"
              placeholder="Short note about this fee"
              @input="modal.desc = ($event.target as HTMLInputElement).value"
            >
          </div>
        </div>
        <div class="flex justify-end gap-2.5 px-6 py-4 border-t border-slate-100">
          <button
            class="border border-slate-200 bg-white text-slate-700 text-[15px] font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer"
            @click="modal = null"
          >
            Cancel
          </button>
          <button
            :disabled="saveDisabled"
            class="border-none text-[15px] font-bold px-5 py-[9px] rounded-lg transition-colors"
            :class="saveDisabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-500 text-white cursor-pointer hover:bg-green-600'"
            @click="saveModal"
          >
            Save
          </button>
        </div>
      </div>
    </div>

    <!-- delete modal -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center z-[210] p-5"
    >
      <div class="bg-white rounded-[14px] w-[440px] max-w-[92vw] shadow-[0_20px_60px_rgba(0,0,0,0.25)] p-6">
        <div class="flex items-center gap-3 mb-2">
          <div :style="deleteIconWrapStyle">
            <UIcon :name="'i-lucide-' + deleteIcon" class="w-[22px] h-[22px]" />
          </div>
          <h3 class="text-[17px] font-bold text-slate-900 m-0">
            {{ deleteTitle }}
          </h3>
        </div>
        <p class="text-[15px] text-slate-500 mt-0 mb-5 leading-normal">
          {{ deleteMessage }}
        </p>
        <div class="flex justify-end gap-2.5">
          <button
            class="border border-slate-200 bg-white text-slate-700 text-[15px] font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer"
            @click="deleteTarget = null"
          >
            {{ deleteCancelLabel }}
          </button>
          <button
            v-if="!deleteBlocked"
            class="border-none bg-red-600 text-white text-[15px] font-bold px-[18px] py-[9px] rounded-lg cursor-pointer"
            @click="confirmDelete"
          >
            Delete
          </button>
        </div>
      </div>
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
.row-hover:hover {
  background: #f8fafc;
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
