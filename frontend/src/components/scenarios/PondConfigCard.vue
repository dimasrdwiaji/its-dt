<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMapStore } from '@/stores/mapStore'
import { useScenarioStore } from '@/stores/scenarioStore'
import Button from 'primevue/button'
import Slider from 'primevue/slider'

const mapStore = useMapStore()
const scenarioStore = useScenarioStore()

// Standard pond depth from intervention_rules.json is 1.5m, adjustable 1.0m to 3.0m
const depthM = ref(1.5)
const COST_PER_M3 = 350000

const areaM2 = computed(() => {
  return mapStore.pendingPond ? Math.round(mapStore.pendingPond.areaM2 * 10) / 10 : 0
})

const volumeM3 = computed(() => {
  return Math.round(areaM2.value * depthM.value * 10) / 10
})

const totalCostIdr = computed(() => {
  return Math.round(volumeM3.value * COST_PER_M3)
})

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val)
}

function handleSavePond() {
  if (!mapStore.pendingPond) return

  scenarioStore.addIntervention({
    id: `pond_${Date.now()}`,
    module: 'hydrology',
    type: 'ground_retention_pond',
    name: `Kolam Retensi (${Math.round(areaM2.value)} m²)`,
    quantity: Math.round(areaM2.value),
    unit: 'm²',
    costIdr: totalCostIdr.value,
    co2OffsetKgYr: 0,
    storageM3: Math.round(volumeM3.value),
    polygon: mapStore.pendingPond.coordinates,
    timestamp: Date.now(),
    metadata: {
      areaM2: areaM2.value,
      depthM: depthM.value,
      volumeM3: volumeM3.value
    }
  })

  mapStore.clearPendingPond()
  mapStore.clearPondPoints()
  mapStore.setActiveTool(null)
}

function handleCancel() {
  mapStore.clearPendingPond()
  mapStore.clearPondPoints()
}
</script>

<template>
  <div v-if="mapStore.pendingPond" class="pond-config-card">
    <div class="card-header">
      <div class="flex align-items-center gap-2">
        <div class="header-icon">
          <i class="pi pi-cloud text-cyan-400"></i>
        </div>
        <div>
          <span class="card-title">New Retention Pond</span>
          <span class="card-subtitle">Configure Basin Dimensions & Capacity</span>
        </div>
      </div>
      <Button
        icon="pi pi-times"
        text
        rounded
        size="small"
        @click="handleCancel"
      />
    </div>

    <div class="card-body">
      <!-- Area Metric -->
      <div class="metric-row">
        <span class="metric-label">Surveyed Surface Area</span>
        <span class="metric-value text-cyan-300">{{ areaM2.toLocaleString('id-ID') }} m²</span>
      </div>

      <!-- Depth Slider -->
      <div class="depth-slider-section">
        <div class="flex justify-content-between align-items-center mb-1">
          <span class="slider-label">Excavation Depth</span>
          <span class="slider-value">{{ depthM.toFixed(1) }} m</span>
        </div>
        <Slider
          v-model="depthM"
          :min="1.0"
          :max="3.0"
          :step="0.1"
          class="w-full"
        />
        <div class="flex justify-content-between text-xs text-slate-400 mt-1">
          <span>Min: 1.0 m</span>
          <span>Standard: 1.5 m</span>
          <span>Max: 3.0 m</span>
        </div>
      </div>

      <!-- Storage & Cost Summary -->
      <div class="summary-box">
        <div class="summary-item">
          <span class="sum-label">Stormwater Storage Volume</span>
          <span class="sum-value text-cyan-400">+{{ volumeM3.toLocaleString('id-ID') }} m³</span>
        </div>
        <div class="summary-item">
          <span class="sum-label">Civil Excavation CapEx</span>
          <span class="sum-value text-amber-400">{{ formatCurrency(totalCostIdr) }}</span>
        </div>
      </div>
    </div>

    <div class="card-footer">
      <Button
        label="Discard"
        icon="pi pi-trash"
        severity="secondary"
        text
        size="small"
        @click="handleCancel"
      />
      <Button
        label="Add to Scenario"
        icon="pi pi-check"
        severity="info"
        size="small"
        @click="handleSavePond"
      />
    </div>
  </div>
</template>

<style scoped>
.pond-config-card {
  position: absolute;
  bottom: 24px;
  right: 24px;
  width: 360px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(6, 182, 212, 0.35);
  border-radius: 12px;
  padding: 16px;
  z-index: 1000;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
  padding-bottom: 10px;
}

.header-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(6, 182, 212, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-title {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
  display: block;
}

.card-subtitle {
  font-size: 10px;
  color: #94a3b8;
  display: block;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: rgba(6, 182, 212, 0.08);
  border-radius: 6px;
  border: 1px solid rgba(6, 182, 212, 0.18);
}

.metric-label {
  font-size: 11px;
  color: #94a3b8;
}

.metric-value {
  font-size: 13px;
  font-weight: 700;
}

.depth-slider-section {
  padding: 8px 10px;
  background: rgba(148, 163, 184, 0.05);
  border-radius: 6px;
}

.slider-label {
  font-size: 11px;
  color: #94a3b8;
}

.slider-value {
  font-size: 12px;
  font-weight: 700;
  color: #e2e8f0;
}

.summary-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sum-label {
  font-size: 11px;
  color: #94a3b8;
}

.sum-value {
  font-size: 13px;
  font-weight: 700;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid rgba(148, 163, 184, 0.15);
  padding-top: 10px;
}
</style>
