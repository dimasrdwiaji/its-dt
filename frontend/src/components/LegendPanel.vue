<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/mapStore'

const mapStore = useMapStore()

const config = computed(() => {
  switch (mapStore.colorMode) {
    case 'energy':
      return {
        title: 'Solar Energy Potential',
        gradient: 'linear-gradient(to right, #fef08a, #f97316, #dc2626)',
        minLabel: 'Low (50 MWh)',
        maxLabel: 'High (1,200+ MWh)'
      }
    case 'ecology':
      return {
        title: 'Vegetation & Shading',
        gradient: 'linear-gradient(to right, #bbf7d0, #16a34a, #14532d)',
        minLabel: 'Low Canopy',
        maxLabel: 'Dense Canopy'
      }
    case 'hydrology':
      return {
        title: 'Adjacent Flood Risk',
        gradient: 'linear-gradient(to right, #bae6fd, #0284c7, #1e3a5f)',
        minLabel: 'Low Risk',
        maxLabel: 'Critical'
      }
    default:
      return null
  }
})
</script>

<template>
  <div v-if="config" class="legend-panel">
    <div class="legend-header">
      <span class="legend-title">{{ config.title }}</span>
    </div>
    <div class="legend-bar" :style="{ background: config.gradient }"></div>
    <div class="legend-ticks">
      <span>{{ config.minLabel }}</span>
      <span>{{ config.maxLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.legend-panel {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 220px;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  padding: 10px 14px;
  z-index: 1000;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #94a3b8;
  text-transform: uppercase;
}

.legend-bar {
  height: 8px;
  border-radius: 4px;
}

.legend-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #64748b;
}
</style>
