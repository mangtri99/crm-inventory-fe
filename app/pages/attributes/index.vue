<script setup lang="ts">
import type { AttributeDef } from '~/types'

useHead({ title: 'Attributes — Vertex' })

// ── state (mirrors the design's DCLogic state) ──
const attrs = ref<AttributeDef[]>([])
const deleteTarget = ref<AttributeDef | null>(null)
const toast = ref<string | null>(null)

let toastTimer: number | null = null

onMounted(() => {
  attrs.value = loadAttributeDefs()
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

// ── create / edit (a dedicated screen, not an inline modal) ──
function onCreate() {
  return navigateTo('/attributes/create')
}
function onEdit(a: AttributeDef) {
  return navigateTo({ path: '/attributes/create', query: { id: a.id } })
}

// ── delete ──
const deleteUsage = computed(() => deleteTarget.value ? attributeUsageCount(deleteTarget.value.name) : 0)
const deleteBlocked = computed(() => deleteUsage.value > 0)
function confirmDelete() {
  const t = deleteTarget.value
  if (!t || deleteBlocked.value) return
  const next = attrs.value.filter(a => a.id !== t.id)
  saveAttributeDefs(next)
  attrs.value = next
  deleteTarget.value = null
  showToast('Attribute deleted')
}
const deleteIcon = computed(() => deleteBlocked.value ? 'shield-alert' : 'trash-2')
const deleteIconWrapStyle = computed(() =>
  'width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:' + (deleteBlocked.value ? '#fffbeb' : '#fef2f2') + ';color:' + (deleteBlocked.value ? '#d97706' : '#dc2626') + ';'
)
const deleteTitle = computed(() => {
  const t = deleteTarget.value
  if (!t) return ''
  return deleteBlocked.value ? 'Cannot delete attribute' : 'Delete ' + t.name + '?'
})
const deleteMessage = computed(() => {
  if (!deleteTarget.value) return ''
  if (!deleteBlocked.value) return 'This action cannot be undone.'
  const u = deleteUsage.value
  return `This attribute is used by ${u} product${u === 1 ? '' : 's'}. Remove it from them first.`
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
      <span class="text-slate-900 font-semibold">Attributes</span>
    </div>

    <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 mt-0 mb-1">
          Attributes
        </h1>
        <p class="text-[15px] text-slate-500 m-0">
          Reusable variant attributes and their values.
        </p>
      </div>
      <button
        class="border-none bg-green-500 text-white text-[15px] font-bold px-[18px] py-2.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5 shadow-sm hover:bg-green-600 transition-colors"
        @click="onCreate"
      >
        <UIcon name="i-lucide-plus" class="w-[15px] h-[15px]" /> Create Attribute
      </button>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div v-if="attrs.length" class="overflow-x-auto">
        <table class="w-full border-collapse min-w-[640px]">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-5 py-[13px] w-[220px]">
                Attribute Name
              </th>
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-[13px] w-[130px]">
                Type
              </th>
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-[13px]">
                Values
              </th>
              <th class="text-right text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-5 py-[13px] w-[130px]">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in attrs" :key="a.id" class="row-hover border-b border-slate-100">
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-2.5">
                  <div class="w-[34px] h-[34px] rounded-lg bg-emerald-50 text-green-600 flex items-center justify-center flex-shrink-0">
                    <UIcon name="i-lucide-tag" class="w-4 h-4" />
                  </div>
                  <span class="text-base font-semibold text-slate-900">{{ a.name }}</span>
                </div>
              </td>
              <td class="px-3 py-3.5">
                <span class="text-sm text-slate-700">{{ a.type || 'Select' }}</span>
              </td>
              <td class="px-3 py-3.5">
                <div v-if="a.values.length" class="flex flex-wrap gap-[5px]">
                  <span
                    v-for="v in a.values"
                    :key="v"
                    class="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-0.5 whitespace-nowrap"
                  >{{ v }}</span>
                </div>
                <span v-else class="text-sm text-slate-300">No values yet</span>
              </td>
              <td class="px-5 py-3.5">
                <div class="flex items-center justify-end gap-2">
                  <button
                    class="btn-icon-hover inline-flex items-center gap-1.5 border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-3.5 py-[7px] rounded-lg cursor-pointer"
                    @click="onEdit(a)"
                  >
                    <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    title="Delete attribute"
                    class="btn-icon-hover border border-slate-200 bg-white text-red-600 w-[34px] h-[34px] rounded-lg cursor-pointer inline-flex items-center justify-center"
                    @click="deleteTarget = a"
                  >
                    <UIcon name="i-lucide-trash-2" class="w-[15px] h-[15px]" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-else
        class="px-6 py-14 flex flex-col items-center gap-2.5 text-center"
      >
        <div class="w-[52px] h-[52px] rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
          <UIcon name="i-lucide-tags" class="w-6 h-6" />
        </div>
        <div class="text-base font-bold text-slate-900">
          No attributes yet
        </div>
        <div class="text-[15px] text-slate-400 max-w-[340px]">
          Create an attribute to reuse it across product variants.
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
