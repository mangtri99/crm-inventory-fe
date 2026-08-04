<script setup lang="ts">
// Base app shell for the Vertex inventory screens: custom sidebar + content slot.
useHead({
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap' }
  ]
})
</script>

<template>
  <div class="vertex-shell flex min-h-screen bg-slate-50 text-slate-900">
    <VertexSidebar />
    <div class="flex-1 min-w-0">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.vertex-shell {
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
