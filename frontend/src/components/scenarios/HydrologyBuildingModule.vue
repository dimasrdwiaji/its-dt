<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useScenarioStore } from '@/stores/scenarioStore'
import type { BuildingProperties } from '@/types/building'
import type { TorenOption } from '@/types/scenario'
import RadialGauge from './RadialGauge.vue'
import ToggleSwitch from 'primevue/toggleswitch'
import Slider from 'primevue/slider'
import Select from 'primevue/select'
import Button from 'primevue/button'
import rulesData from '@/intervention_rules.json'

const props = defineProps<{
  building: BuildingProperties
}>()

const scenarioStore = useScenarioStore()

const torenOptions = ref<TorenOption[]>(rulesData.hydrology.toren_options)
const selectedToren = ref<TorenOption>(torenOptions.value[2] || torenOptions.value[0]) // Default 5,000L

const maxUnits = 10
const existing = scenarioStore.getBuildingToren(props.building.id)
const showToren = ref(!!existing)
const torenCount = ref(existing ? existing.quantity : 2)

const totalStorageM3 = computed(() => {
  const cap = selectedToren.value?.capacity_m3 || 5.0
  return Number((torenCount.value * cap).toFixed(1))
})

const roofRunoffM3 = computed(() => {
  return Number(props.building.roof_runoff_vol_m3) || 50
})

const retainedPercent = computed(() => {
  if (roofRunoffM3.value <= 0) return 0
  return Math.min(100, Math.round((totalStorageM3.value / roofRunoffM3.value) * 100))
})

const totalCostIdr = computed(() => {
  const unitCost = selectedToren.value?.cost_idr || 6800000
  return torenCount.value * unitCost
})

function saveToScenario() {
  scenarioStore.saveBuildingToren({
    id: `toren_bldg_${props.building.id}`,
    buildingId: props.building.id,
    buildingName: props.building.name || `Building #${props.building.id}`,
    module: 'hydrology',
    type: 'rooftop_toren',
    name: selectedToren.value.name,
    quantity: torenCount.value,
    unit: 'tanks',
    costIdr: totalCostIdr.value,
    co2OffsetKgYr: 0,
    storageM3: totalStorageM3.value,
    timestamp: Date.now(),
    metadata: {
      showToren: showToren.value,
      capacityM3PerUnit: selectedToren.value.capacity_m3,
      retainedPercent: retainedPercent.value
    }
  })
}

watch(showToren, (val) => {
  if (!val && existing) {
    scenarioStore.removeIntervention(existing.id)
  } else if (val) {
    saveToScenario()
  }
})
</script>

<template>
  <div class="hydrology-module-card">
    <!-- Header Toggle -->
    <div class="module-toggle-row">
      <span class="toggle-label">Show rooftop toren</span>
      <ToggleSwitch v-model="showToren" />
    </div>

    <!-- Toren Model Specification Select -->
    <div class="model-select-row">
      <Select
        v-model="selectedToren"
        :options="torenOptions"
        optionLabel="name"
        placeholder="Select Tank Capacity"
        class="w-full text-xs"
        size="small"
      />
    </div>

    <!-- Dual Radial Gauge Cards Matching Screenshot -->
    <div class="gauge-cards-grid">
      <!-- Toren Count Card -->
      <div class="gauge-card">
        <span class="gauge-title">Tank Units</span>
        <RadialGauge
          :value="torenCount"
          :max="maxUnits"
          icon="pi pi-box"
          color="#0284c7"
        />
        <div class="gauge-value text-sky-400">
          {{ torenCount }} <span class="gauge-denom">/ {{ maxUnits }}</span>
        </div>
      </div>

      <!-- Runoff Retained Output Card -->
      <div class="gauge-card">
        <span class="gauge-title">Runoff Retained</span>
        <RadialGauge
          :value="retainedPercent"
          :max="100"
          icon="pi pi-cloud-download"
          color="#38bdf8"
        />
        <div class="gauge-value text-cyan-400">
          {{ retainedPercent }}% <span class="gauge-unit">({{ totalStorageM3 }} m³)</span>
        </div>
      </div>
    </div>

    <!-- Interactive Toren Count Slider -->
    <div class="slider-container">
      <div class="slider-header">
        <div class="flex align-items-center gap-2">
          <i class="pi pi-box text-sky-400"></i>
          <span class="slider-label">Tank count</span>
        </div>
        <span class="slider-number">{{ torenCount }} units</span>
      </div>
      <Slider
        v-model="torenCount"
        :min="1"
        :max="maxUnits"
        :step="1"
        class="w-full"
      />
    </div>

    <!-- Storage and Investment Summary -->
    <div class="financials-box">
      <div class="metric-line">
        <span class="text-slate-400">Tank Capacity:</span>
        <span class="font-semibold text-slate-200">{{ selectedToren.capacity_liters.toLocaleString() }} L / unit</span>
      </div>
      <div class="metric-line">
        <span class="text-slate-400">Storm Roof Runoff:</span>
        <span class="font-semibold text-slate-200">{{ roofRunoffM3 }} m³</span>
      </div>
      <div class="metric-line">
        <span class="text-slate-400">Estimated CapEx:</span>
        <span class="font-semibold text-sky-400">Rp {{ totalCostIdr.toLocaleString('id-ID') }}</span>
      </div>
      <div class="metric-line">
        <span class="text-slate-400">Mitigation:</span>
        <span class="font-semibold text-primary">Direct Retention</span>
      </div>
    </div>

    <!-- Action Button -->
    <Button
      label="Save Toren to Scenario"
      icon="pi pi-check"
      size="small"
      class="w-full mt-2"
      severity="info"
      @click="saveToScenario"
    />
  </div>
</template>

<style scoped>
.hydrology-module-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(30, 41, 59, 0.45);
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 10px;
  padding: 12px;
}

.module-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toggle-label {
  font-size: 12px;
  font-weight: 600;
  color: #cbd5e1;
}

.model-select-row {
  margin-top: -2px;
}

.gauge-cards-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.gauge-card {
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.gauge-title {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.gauge-value {
  font-size: 13px;
  font-weight: 700;
  margin-top: 2px;
}

.gauge-denom {
  font-size: 11px;
  font-weight: 400;
  color: #64748b;
}

.gauge-unit {
  font-size: 10px;
  font-weight: 500;
  color: #94a3b8;
}

.slider-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0;
}

.slider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.slider-label {
  color: #cbd5e1;
  font-weight: 500;
}

.slider-number {
  font-weight: 700;
  color: #f1f5f9;
}

.financials-box {
  background: rgba(15, 23, 42, 0.4);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
}

.metric-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
