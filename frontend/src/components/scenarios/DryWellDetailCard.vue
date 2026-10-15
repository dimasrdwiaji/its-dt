<script setup lang="ts">
import { useMapStore } from '@/stores/mapStore'
import { useScenarioStore } from '@/stores/scenarioStore'
import Button from 'primevue/button'

const mapStore = useMapStore()
const scenarioStore = useScenarioStore()

function handleClose() {
  mapStore.setSelectedDryWell(null)
}

function handleRemove() {
  if (mapStore.selectedDryWell?.id) {
    scenarioStore.removeIntervention(mapStore.selectedDryWell.id)
  }
  handleClose()
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val)
}
</script>

<template>
  <div v-if="mapStore.selectedDryWell" class="dry-well-card">
    <div class="card-header">
      <div class="flex align-items-center gap-2">
        <div class="header-icon">
          <i class="pi pi-circle text-sky-400"></i>
        </div>
        <div>
          <span class="card-title">Modular Dry Well</span>
          <span class="card-subtitle">Sumur Resapan Moduler (Ground Infiltration)</span>
        </div>
      </div>
      <Button
        icon="pi pi-times"
        text
        rounded
        size="small"
        @click="handleClose"
      />
    </div>

    <div class="card-body">
      <div class="specs-grid">
        <div class="spec-item">
          <span class="spec-label">Internal Diameter</span>
          <span class="spec-value">{{ mapStore.selectedDryWell.metadata?.diameterM || 1.0 }} m</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Borehole Depth</span>
          <span class="spec-value">{{ mapStore.selectedDryWell.metadata?.depthM || 2.5 }} m</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Recharge Volume</span>
          <span class="spec-value text-sky-400">+{{ mapStore.selectedDryWell.storageM3 || 2.0 }} m³</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Installation CapEx</span>
          <span class="spec-value text-amber-400">{{ formatCurrency(mapStore.selectedDryWell.costIdr || 1800000) }}</span>
        </div>
      </div>

      <div class="info-note">
        <i class="pi pi-info-circle text-sky-400 text-xs"></i>
        <span class="text-xs text-slate-300">
          Provides decentralized stormwater infiltration, reducing campus peak runoff coefficient and recharging the shallow aquifer.
        </span>
      </div>
    </div>

    <div class="card-footer">
      <Button
        label="Remove Well"
        icon="pi pi-trash"
        severity="danger"
        text
        size="small"
        @click="handleRemove"
      />
      <Button
        label="Close"
        icon="pi pi-check"
        severity="secondary"
        size="small"
        @click="handleClose"
      />
    </div>
  </div>
</template>

<style scoped>
.dry-well-card {
  position: absolute;
  bottom: 24px;
  right: 24px;
  width: 340px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(14, 165, 233, 0.35);
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
  background: rgba(14, 165, 233, 0.15);
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

.specs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.spec-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  background: rgba(148, 163, 184, 0.05);
  border-radius: 6px;
}

.spec-label {
  font-size: 10px;
  color: #94a3b8;
}

.spec-value {
  font-size: 12px;
  font-weight: 700;
  color: #e2e8f0;
}

.info-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(14, 165, 233, 0.08);
  border-radius: 6px;
  border: 1px solid rgba(14, 165, 233, 0.18);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid rgba(148, 163, 184, 0.15);
  padding-top: 10px;
}
</style>
