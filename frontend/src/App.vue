<script setup lang="ts">
import GlobalNavbar from '@/components/GlobalNavbar.vue'
</script>

<template>
  <div class="app-layout">
    <GlobalNavbar />
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <keep-alive include="DigitalTwinView">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-canvas);
}

.main-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}
</style>
