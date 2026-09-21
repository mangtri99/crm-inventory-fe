<script setup lang="ts">
import type { Platform } from '~/types'

useHead({ title: 'Platforms — Vertex' })

// ── state (mirrors the design's DCLogic state) ──
const platforms = ref<Platform[]>([...PLATFORM_SEED])
const deleteTarget = ref<Platform | null>(null)
const toast = ref<string | null>(null)

let toastTimer: number | null = null

onMounted(() => {
  platforms.value = loadPlatforms()
  // cross-page success toast set by the Create Platform screen
  try {
    const t = sessionStorage.getItem('vertex_platform_toast')
    if (t) {
      sessionStorage.removeItem('vertex_platform_toast')
      showToast(t)
    }
  } catch {
    // ignore
  }
})
onBeforeUnmount(() => {
  if (toastTimer !== null) clearTimeout(toastTimer)
})

function showToast(msg: string) {
  toast.value = msg
  if (toastTimer !== null) clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 3000)
}

function editHref(id: string) {
  return { path: '/platforms/config', query: { id } }
}

// ── delete ──
const deleteAssigned = computed(() => deleteTarget.value ? platformAssignedCount(deleteTarget.value.id) : 0)
const deleteBlocked = computed(() => deleteAssigned.value > 0)
function confirmDelete() {
  const t = deleteTarget.value
  if (!t || deleteBlocked.value) return
  const next = platforms.value.filter(p => p.id !== t.id)
  savePlatforms(next)
  platforms.value = next
  deleteTarget.value = null
  showToast('Platform deleted')
}
const deleteIcon = computed(() => deleteBlocked.value ? 'shield-alert' : 'trash-2')
const deleteIconWrapStyle = computed(() =>
  'width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:' + (deleteBlocked.value ? '#fffbeb' : '#fef2f2') + ';color:' + (deleteBlocked.value ? '#d97706' : '#dc2626') + ';'
)
const deleteTitle = computed(() => {
  const t = deleteTarget.value
  if (!t) return ''
  return deleteBlocked.value ? 'Cannot delete platform' : 'Delete ' + t.name + '?'
})
const deleteMessage = computed(() => {
  if (!deleteTarget.value) return ''
  if (!deleteBlocked.value) return 'This action cannot be undone.'
  const a = deleteAssigned.value
  return `This platform is assigned to ${a} product${a === 1 ? '' : 's'}. Unassign it first.`
})
const deleteCancelLabel = computed(() => deleteBlocked.value ? 'Close' : 'Cancel')
</script>

<template>
  <div class="flex-1 min-w-0 px-8 pt-7 pb-20">
    <div class="text-[13px] text-slate-500 mb-3.5">
      <NuxtLink to="/dashboard" class="text-green-600 no-underline hover:text-green-700">
        Inventory
      </NuxtLink> <span class="text-slate-300">/</span> <span class="text-slate-900 font-semibold">Platforms</span>
    </div>

    <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 mt-0 mb-1">
          Platforms
        </h1>
        <p class="text-[15px] text-slate-500 m-0">
          Sales channels under Vertex Digital Marketing.
        </p>
      </div>
      <div class="flex items-center gap-2.5">
        <NuxtLink
          to="/platforms/create"
          class="border-none bg-green-500 text-white text-[15px] font-bold px-[18px] py-2.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5 no-underline shadow-sm hover:bg-green-600 transition-colors"
        >
          <UIcon name="i-lucide-plus" class="w-[15px] h-[15px]" /> Create Platform
        </NuxtLink>
      </div>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div v-if="platforms.length" class="overflow-x-auto">
        <table class="w-full border-collapse min-w-[640px]">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-5 py-[13px]">
                Platform Name
              </th>
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-[13px]">
                Code
              </th>
              <th class="text-left text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-3 py-[13px]">
                URL / Path
              </th>
              <th class="text-right text-sm font-bold text-slate-500 uppercase tracking-[0.03em] px-5 py-[13px]">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in platforms" :key="p.id" class="row-hover border-b border-slate-100">
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-2.5">
                  <div class="w-[34px] h-[34px] rounded-lg bg-emerald-50 text-green-600 flex items-center justify-center flex-shrink-0">
                    <UIcon name="i-lucide-globe" class="w-[17px] h-[17px]" />
                  </div>
                  <span class="text-base font-semibold text-slate-900">{{ p.name }}</span>
                </div>
              </td>
              <td class="px-3 py-3.5">
                <span class="font-mono text-[13px] text-slate-600 bg-slate-100 border border-slate-200 rounded-md px-2 py-[3px]">{{ p.code }}</span>
              </td>
              <td class="px-3 py-3.5 text-[15px] text-slate-700">
                {{ p.url }}
              </td>
              <td class="px-5 py-3.5">
                <div class="flex items-center justify-end gap-2">
                  <NuxtLink
                    :to="editHref(p.id)"
                    class="btn-icon-hover inline-flex items-center gap-1.5 border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-3.5 py-[7px] rounded-lg no-underline"
                  >
                    <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" /> Edit
                  </NuxtLink>
                  <button
                    title="Delete platform"
                    class="btn-icon-hover border border-slate-200 bg-white text-red-600 w-[34px] h-[34px] rounded-lg cursor-pointer inline-flex items-center justify-center"
                    @click="deleteTarget = p"
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
          <UIcon name="i-lucide-globe" class="w-6 h-6" />
        </div>
        <div class="text-base font-bold text-slate-900">
          No platforms yet
        </div>
        <div class="text-[15px] text-slate-400 max-w-[340px]">
          Create your first platform to start assigning products to sales channels.
        </div>
        <NuxtLink
          to="/platforms/create"
          class="mt-2 border-none bg-green-500 text-white text-[15px] font-bold px-[18px] py-2.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5 no-underline"
        >
          <UIcon name="i-lucide-plus" class="w-[15px] h-[15px]" /> Create Platform
        </NuxtLink>
      </div>
    </div>

    <!-- delete modal -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center z-[200] p-5"
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
