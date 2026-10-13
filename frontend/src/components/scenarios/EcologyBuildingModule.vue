<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useScenarioStore } from '@/stores/scenarioStore'
import type { BuildingProperties } from '@/types/building'
import RadialGauge from './RadialGauge.vue'
import ToggleSwitch from 'primevue/toggleswitch'
import Slider from 'primevue/slider'
import Button from 'primevue/button'
import rulesData from '@/intervention_rules.json'

const props = defineProps<{
  building: BuildingProperties
}>()

const scenarioStore = useScenarioStore()
const greeningSpec = rulesData.ecology.vertical_greening[0]

// Approximate building perimeter in meters from footprint area (assuming ~aspect ratio 1.5)
const approxPerimeterM = computed(() => {
  const area = Number(props.building.area) || 400
  // Perimeter of rectangle with aspect ratio 1.5: 2 * (sqrt(A/1.5) + 1.5*sqrt(A/1.5)) ≈ 4.08 * sqrt(A)
  return Math.round(4.1 * Math.sqrt(area))
})

const buildingHeightM = computed(() => {
  return Number(props.building.height_google || props.building.height_osm || 10)
})

// Standard 3-meter modular green wall trellis height (spandrel / balcony planting)
const frameDrapeHeightM = 3.0

// Maximum facade area covered by modular greening frame
const maxFacadeAreaM2 = computed(() => {
  return Math.round(approxPerimeterM.value * frameDrapeHeightM)
})

const existing = scenarioStore.getBuildingGreening(props.building.id)
const showGreening = ref(!!existing)
const coveredAreaM2 = ref(existing ? existing.quantity : Math.round(maxFacadeAreaM2.value * 0.4))

watch(maxFacadeAreaM2, (newMax) => {
  if (coveredAreaM2.value > newMax) {
    coveredAreaM2.value = newMax
  }
})

const coverageRatio = computed(() => {
  if (maxFacadeAreaM2.value <= 0) return 0
  return coveredAreaM2.value / maxFacadeAreaM2.value
})

const coolingDeltaC = computed(() => {
  const maxCooling = greeningSpec.wall_cooling_celsius || 2.4
  return Number((maxCooling * (0.3 + 0.7 * coverageRatio.value)).toFixed(1))
})

const totalCostIdr = computed(() => {
  return Math.round(coveredAreaM2.value * greeningSpec.cost_idr_per_m2)
})

const co2MitigationKg = computed(() => {
  return Math.round(coveredAreaM2.value * greeningSpec.co2_mitigation_kg_m2_yr)
})

function saveToScenario() {
  scenarioStore.saveBuildingGreening({
    id: `greening_bldg_${props.building.id}`,
    buildingId: props.building.id,
    buildingName: props.building.name || `Building #${props.building.id}`,
    module: 'ecology',
    type: 'vertical_greening',
    name: greeningSpec.name,
    quantity: coveredAreaM2.value,
    unit: 'm²',
    costIdr: totalCostIdr.value,
    co2OffsetKgYr: co2MitigationKg.value,
    coolingDeltaC: coolingDeltaC.value,
    timestamp: Date.now(),
    metadata: {
      showGreening: showGreening.value,
      coolingDeltaC: coolingDeltaC.value,
      species: greeningSpec.plant_species
    }
  })
}

watch(showGreening, (val) => {
  if (!val && existing) {
    scenarioStore.removeIntervention(existing.id)
  } else if (val) {
    saveToScenario()
  }
})
</script>

<template>
  <div class="ecology-module-card">
    <!-- Header Toggle -->
    <div class="module-toggle-row">
      <span class="toggle-label">Show vertical greening on facade</span>
      <ToggleSwitch v-model="showGreening" />
    </div>

    <div class="spec-description">
      <i class="pi pi-info-circle text-emerald-400 mr-1"></i>
      <span>Singapore-style modular planter boxes with stainless steel trellis frames & drip irrigation.</span>
    </div>

    <!-- Dual Radial Gauge Cards Matching Screenshot -->
    <div class="gauge-cards-grid">
      <!-- Facade Frame Coverage Card -->
      <div class="gauge-card">
        <span class="gauge-title">Facade Frame</span>
        <RadialGauge
          :value="coveredAreaM2"
          :max="maxFacadeAreaM2"
          icon="pi pi-box"
          color="#10b981"
        />
        <div class="gauge-value text-emerald-400">
          {{ coveredAreaM2 }} <span class="gauge-denom">/ {{ maxFacadeAreaM2 }} m²</span>
        </div>
      </div>

      <!-- Wall Cooling Card -->
      <div class="gauge-card">
        <span class="gauge-title">Wall Cooling</span>
        <RadialGauge
          :value="coolingDeltaC"
          :max="3.0"
          icon="pi pi-leaf"
          color="#22c55e"
        />
        <div class="gauge-value text-green-400">
          -{{ coolingDeltaC }} <span class="gauge-unit">°C</span>
        </div>
      </div>
    </div>

    <!-- Interactive Facade Coverage Slider -->
    <div class="slider-container">
      <div class="slider-header">
        <div class="flex align-items-center gap-2">
          <i class="pi pi-leaf text-emerald-400"></i>
          <span class="slider-label">Modular Planter Area</span>
        </div>
        <span class="slider-number">{{ coveredAreaM2 }} m²</span>
      </div>
      <Slider
        v-model="coveredAreaM2"
        :min="0"
        :max="maxFacadeAreaM2"
        :step="5"
        class="w-full"
      />
    </div>

    <!-- Financials & Environmental Impact Summary -->
    <div class="financials-box">
      <div class="metric-line">
        <span class="text-slate-400">Plant Species:</span>
        <span class="font-semibold text-slate-200">Lee Kuan Yew vine</span>
      </div>
      <div class="metric-line">
        <span class="text-slate-400">Installation CapEx:</span>
        <span class="font-semibold text-slate-200">Rp {{ totalCostIdr.toLocaleString('id-ID') }}</span>
      </div>
      <div class="metric-line">
        <span class="text-slate-400">Annual CO2 Absorption:</span>
        <span class="font-semibold text-emerald-400">{{ co2MitigationKg }} kg/yr</span>
      </div>
      <div class="metric-line">
        <span class="text-slate-400">Microclimate Impact:</span>
        <span class="font-semibold text-primary">Surface Heat Barrier</span>
      </div>
    </div>

    <!-- Action Button -->
    <Button
      label="Save Greening to Scenario"
      icon="pi pi-check"
      size="small"
      class="w-full mt-2"
      severity="success"
      @click="saveToScenario"
    />
  </div>
</template>

<style scoped>
.ecology-module-card {
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

.spec-description {
  font-size: 10.5px;
  color: #94a3b8;
  line-height: 1.3;
  background: rgba(15, 23, 42, 0.4);
  padding: 6px 8px;
  border-radius: 6px;
  display: flex;
  align-items: flex-start;
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
