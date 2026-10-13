<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useScenarioStore } from '@/stores/scenarioStore'
import type { BuildingProperties } from '@/types/building'
import type { SolarPanelModel } from '@/types/scenario'
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

const solarModels = ref<SolarPanelModel[]>(rulesData.energy.solar_panels)
const selectedModel = ref<SolarPanelModel>(solarModels.value[1] || solarModels.value[0]) // Default 550Wp

const roofType = ref<'flat' | 'tilted'>('flat')
const packingFactor = computed(() => {
  return roofType.value === 'flat'
    ? rulesData.energy.packing_factors.flat_roof
    : rulesData.energy.packing_factors.tilted_roof
})

// Calculate maximum allowable panels based on roof area and packing factor
const maxPanels = computed(() => {
  const area = Number(props.building.area) || 0
  const effectiveArea = area * packingFactor.value
  const panelArea = selectedModel.value?.area_m2 || 2.5
  return Math.max(1, Math.floor(effectiveArea / panelArea))
})

const existing = scenarioStore.getBuildingSolar(props.building.id)
const showPanels = ref(!!existing)
const panelCount = ref(existing ? existing.quantity : Math.round(maxPanels.value * 0.6))

watch(maxPanels, (newMax) => {
  if (panelCount.value > newMax) {
    panelCount.value = newMax
  }
})

// Ratio of current panels to max panels
const panelRatio = computed(() => {
  if (maxPanels.value <= 0) return 0
  return panelCount.value / maxPanels.value
})

// Calculate energy output based on building precalculated energy range
const minYieldKWh = computed(() => {
  const minAnnual = Number(props.building.pot_energy_min) || 0
  return Math.round(minAnnual * panelRatio.value)
})

const maxYieldKWh = computed(() => {
  const maxAnnual = Number(props.building.pot_energy_max) || 0
  return Math.round(maxAnnual * panelRatio.value)
})

const estimatedKWh = computed(() => {
  const meanAnnual = Number(props.building.pot_energy_mean) || 0
  return Math.round(meanAnnual * panelRatio.value)
})

const maxCapacityKWh = computed(() => {
  return Math.round(Number(props.building.pot_energy_mean) || 100000)
})

// Financials & Installed Capacity
const installedCapacityKWp = computed(() => {
  const wpPerPanel = selectedModel.value?.power_wp || 550
  return Number(((panelCount.value * wpPerPanel) / 1000).toFixed(1))
})

const totalCostIdr = computed(() => {
  const costPerPanel = selectedModel.value?.cost_per_panel_idr || 2800000
  // Includes BOS and installation buffer
  return panelCount.value * costPerPanel
})

const annualSavingsIdr = computed(() => {
  return Math.round(estimatedKWh.value * rulesData.energy.grid_params.pln_tariff_idr_per_kwh)
})

const co2MitigationKg = computed(() => {
  return Math.round(estimatedKWh.value * rulesData.energy.grid_params.jamali_emission_factor_kg_per_kwh)
})

const paybackYears = computed(() => {
  if (annualSavingsIdr.value <= 0) return '0.0'
  return (totalCostIdr.value / annualSavingsIdr.value).toFixed(1)
})

function saveToScenario() {
  scenarioStore.saveBuildingSolar({
    id: `solar_bldg_${props.building.id}`,
    buildingId: props.building.id,
    buildingName: props.building.name || `Building #${props.building.id}`,
    module: 'energy',
    type: 'solar_rooftop',
    name: `Solar PV: ${selectedModel.value.brand}`,
    quantity: panelCount.value,
    unit: 'panels',
    costIdr: totalCostIdr.value,
    co2OffsetKgYr: co2MitigationKg.value,
    energyMWhYr: Number((estimatedKWh.value / 1000).toFixed(2)),
    timestamp: Date.now(),
    metadata: {
      showPanels: showPanels.value,
      installedKWp: installedCapacityKWp.value,
      brand: selectedModel.value.brand,
      roofType: roofType.value
    }
  })
}

// Auto-sync toggle state to scenario
watch(showPanels, (val) => {
  if (!val && existing) {
    scenarioStore.removeIntervention(existing.id)
  } else if (val) {
    saveToScenario()
  }
})
</script>

<template>
  <div class="solar-module-card">
    <!-- Header Toggle -->
    <div class="module-toggle-row">
      <span class="toggle-label">Show panels on roof</span>
      <ToggleSwitch v-model="showPanels" />
    </div>

    <!-- Panel Model Specification Select -->
    <div class="model-select-row">
      <Select
        v-model="selectedModel"
        :options="solarModels"
        optionLabel="brand"
        placeholder="Select Panel Specification"
        class="w-full text-xs"
        size="small"
      />
    </div>

    <!-- Dual Radial Gauge Cards Matching Screenshot -->
    <div class="gauge-cards-grid">
      <!-- Panel Count Card -->
      <div class="gauge-card">
        <span class="gauge-title">Panel count</span>
        <RadialGauge
          :value="panelCount"
          :max="maxPanels"
          icon="pi pi-sun"
          color="#3b82f6"
        />
        <div class="gauge-value text-blue-400">
          {{ panelCount }} <span class="gauge-denom">/ {{ maxPanels }}</span>
        </div>
      </div>

      <!-- Energy Output Card -->
      <div class="gauge-card">
        <span class="gauge-title">Energy Output</span>
        <RadialGauge
          :value="estimatedKWh"
          :max="maxCapacityKWh"
          icon="pi pi-bolt"
          color="#22c55e"
        />
        <div class="gauge-value text-green-400">
          {{ estimatedKWh.toLocaleString() }} <span class="gauge-unit">kWh</span>
        </div>
      </div>
    </div>

    <!-- Interactive Panel Count Slider -->
    <div class="slider-container">
      <div class="slider-header">
        <div class="flex align-items-center gap-2">
          <i class="pi pi-sun text-blue-400"></i>
          <span class="slider-label">Panel count</span>
        </div>
        <span class="slider-number">{{ panelCount }}</span>
      </div>
      <Slider
        v-model="panelCount"
        :min="0"
        :max="maxPanels"
        :step="1"
        class="w-full"
      />
    </div>

    <!-- Parametric Impact Summary -->
    <div class="financials-box">
      <div class="metric-line">
        <span class="text-slate-400">Capacity:</span>
        <span class="font-semibold text-slate-200">{{ installedCapacityKWp }} kWp</span>
      </div>
      <div class="metric-line">
        <span class="text-slate-400">Estimated CapEx:</span>
        <span class="font-semibold text-slate-200">Rp {{ totalCostIdr.toLocaleString('id-ID') }}</span>
      </div>
      <div class="metric-line">
        <span class="text-slate-400">Annual PLN Savings:</span>
        <span class="font-semibold text-emerald-400">Rp {{ annualSavingsIdr.toLocaleString('id-ID') }}</span>
      </div>
      <div class="metric-line">
        <span class="text-slate-400">Payback Period:</span>
        <span class="font-semibold text-primary">{{ paybackYears }} years</span>
      </div>
    </div>

    <!-- Action Button -->
    <Button
      label="Save Solar to Scenario"
      icon="pi pi-check"
      size="small"
      class="w-full mt-2"
      severity="primary"
      @click="saveToScenario"
    />
  </div>
</template>

<style scoped>
.solar-module-card {
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
