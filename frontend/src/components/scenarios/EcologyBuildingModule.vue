<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useScenarioStore } from '@/stores/scenarioStore'
import type { BuildingProperties } from '@/types/building'
import RadialGauge from './RadialGauge.vue'
import ToggleSwitch from 'primevue/toggleswitch'
import Slider from 'primevue/slider'
import Button from 'primevue/button'
import FormulaTooltip from '@/components/common/FormulaTooltip.vue'
import rulesData from '@/intervention_rules.json'

const props = defineProps<{
  building: BuildingProperties
  exactPerimeterM?: number
}>()

const scenarioStore = useScenarioStore()
const greeningSpec = rulesData.ecology.vertical_greening[0]

// Exact perimeter from GIS polygon boundary (or fallback approximation if uncalculated)
const perimeterM = computed(() => {
  if (props.exactPerimeterM) return props.exactPerimeterM
  const area = Number(props.building.area) || 400
  return Math.round(4.1 * Math.sqrt(area))
})

const buildingHeightM = computed(() => {
  return Number(props.building.height_google || props.building.height_osm || 10)
})

const grossWallAreaM2 = computed(() => {
  return Math.round(perimeterM.value * buildingHeightM.value)
})

// Net unobstructed facade area suitable for modular trellis frames (40% excluding windows/openings)
const maxFacadeAreaM2 = computed(() => {
  return Math.max(10, Math.round(grossWallAreaM2.value * 0.40))
})

const existing = scenarioStore.getBuildingGreening(props.building.id)
const showGreening = ref(!!existing)
const coveredAreaM2 = ref(existing ? existing.quantity : Math.min(maxFacadeAreaM2.value, Math.round(maxFacadeAreaM2.value * 0.35)))

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

const co2MitigationKgYr = computed(() => {
  return Math.round(coveredAreaM2.value * greeningSpec.co2_mitigation_kg_m2_yr)
})

function saveToScenario() {
  scenarioStore.saveBuildingGreening({
    id: `greening_bldg_${props.building.id}`,
    buildingId: props.building.id,
    buildingName: props.building.name || `Building #${props.building.id}`,
    module: 'ecology',
    type: 'vertical_greening',
    name: `${coveredAreaM2.value} m² ${greeningSpec.name}`,
    quantity: coveredAreaM2.value,
    unit: 'm²',
    costIdr: totalCostIdr.value,
    co2OffsetKgYr: co2MitigationKgYr.value,
    coolingDeltaC: coolingDeltaC.value,
    timestamp: Date.now(),
    metadata: {
      showGreening: showGreening.value,
      plantSpecies: greeningSpec.plant_species,
      coveredAreaM2: coveredAreaM2.value,
      maxFacadeAreaM2: maxFacadeAreaM2.value,
      wallCoolingC: coolingDeltaC.value
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
      <span class="toggle-label">Show facade green wall</span>
      <ToggleSwitch v-model="showGreening" />
    </div>

    <!-- System Description Chip -->
    <div class="system-chip">
      <div class="flex align-items-center gap-2">
        <i class="pi pi-leaf text-green-400 text-xs"></i>
        <span class="font-bold text-xs text-slate-200">Vernonia elliptica (Lee Kuan Yew)</span>
      </div>
      <span class="text-xs text-slate-400 mt-1 block">
        Modular stainless steel trellis with automated drip irrigation. Shading drops building exterior wall heat flux.
      </span>
    </div>

    <!-- Dual Radial Gauges -->
    <!-- Dual Radial Gauges -->
    <div class="gauge-cards-grid">
      <!-- Facade Area Card -->
      <div class="gauge-card">
        <div class="flex align-items-center justify-content-center gap-1">
          <span class="gauge-title">Facade Area</span>
          <FormulaTooltip
            title="Net Plantable Facade Area"
            plainWords="Maximum exterior wall area appropriate for climber greening trellises, derived from the building's exact GIS polygon perimeter and height, assuming 40% net unobstructed wall surface."
            formula="A_facade, max = Perimeter × Height × 0.40  (m²)"
            :variables="[
              { name: 'Polygon Perimeter', value: `${perimeterM} m`, desc: 'Exact GIS boundary edge sum' },
              { name: 'Building Height', value: `${buildingHeightM} m` },
              { name: 'Net Wall Fraction', value: '40% (60% windows/setbacks)' }
            ]"
            standard="BCA Singapore Green Mark Envelope Thermal Transfer Standard"
            source="Buildings WGS84 GeoJSON Exact Polygons"
          />
        </div>
        <RadialGauge
          :value="coveredAreaM2"
          :max="maxFacadeAreaM2"
          icon="pi pi-th-large"
          color="#10b981"
        />
        <div class="gauge-value text-emerald-400">
          {{ coveredAreaM2 }} <span class="gauge-denom">/ {{ maxFacadeAreaM2 }} m²</span>
        </div>
      </div>

      <!-- Surface Cooling Card -->
      <div class="gauge-card">
        <div class="flex align-items-center justify-content-center gap-1">
          <span class="gauge-title">Wall Cooling</span>
          <FormulaTooltip
            title="Exterior Wall Temperature Reduction"
            plainWords="Exterior surface cooling achieved through dense foliage shading and vegetative evapotranspiration."
            formula="ΔT = -2.4°C × (0.30 + 0.70 × (A_covered ÷ A_max))"
            :variables="[
              { name: 'Max Shading Drop', value: '-2.4°C' },
              { name: 'Wall Coverage', value: `${(coverageRatio * 100).toFixed(0)}%` }
            ]"
            standard="Tropical Facade Foliage Attenuation Empirical Model"
            source="NUS / Singapore Green Mark Experimental Field Trials"
          />
        </div>
        <RadialGauge
          :value="coolingDeltaC"
          :max="2.4"
          icon="pi pi-sun"
          color="#38bdf8"
        />
        <div class="gauge-value text-cyan-400">
          -{{ coolingDeltaC }} <span class="gauge-unit">°C</span>
        </div>
      </div>
    </div>

    <!-- Interactive Area Slider -->
    <div class="slider-control-section">
      <div class="flex justify-between text-xs text-slate-300 mb-1">
        <span>Installed Trellis Area</span>
        <span class="font-bold text-emerald-400">{{ coveredAreaM2 }} m² ({{ (coverageRatio * 100).toFixed(0) }}%)</span>
      </div>
      <Slider
        v-model="coveredAreaM2"
        :min="10"
        :max="maxFacadeAreaM2"
        class="w-full"
        @change="showGreening && saveToScenario()"
      />
    </div>

    <!-- Parametric Impact Summary -->
    <div class="financials-box">
      <div class="metric-line">
        <span class="text-slate-400 flex align-items-center">
          CO2 Absorption:
          <FormulaTooltip
            title="Annual Carbon Sequestration"
            plainWords="Annual mass of atmospheric carbon dioxide sequestered into plant biomass by Vernonia elliptica (Lee Kuan Yew)."
            formula="CO₂ = A_trellis × 8.5 kg CO₂/m²/yr"
            :variables="[
              { name: 'Trellis Area', value: `${coveredAreaM2} m²` },
              { name: 'Absorption Factor', value: '8.5 kg CO2/m²/yr' }
            ]"
          />
        </span>
        <span class="font-semibold text-emerald-400">+{{ co2MitigationKgYr }} kg/yr</span>
      </div>
      <div class="metric-line">
        <span class="text-slate-400 flex align-items-center">
          Estimated CapEx:
          <FormulaTooltip
            title="Vertical Greening System CapEx"
            plainWords="Total turnkey installation rate including modular marine-grade 316 stainless steel wire trellis, planting beds, soil substrate, and automated drip irrigation."
            formula="CapEx = A_trellis × Unit Rate  (Rp)"
            :variables="[
              { name: 'Trellis Area', value: `${coveredAreaM2} m²` },
              { name: 'Unit Rate', value: 'Rp 650,000 / m²' }
            ]"
            source="Commercial Vertical Landscaping Catalog"
          />
        </span>
        <span class="font-semibold text-slate-200">Rp {{ totalCostIdr.toLocaleString('id-ID') }}</span>
      </div>
    </div>

    <!-- Action Button -->
    <Button
      label="Update Greening in Scenario"
      icon="pi pi-check"
      size="small"
      class="w-full mt-1"
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
  width: 100%;
  box-sizing: border-box;
  padding: 2px 0;
  background: transparent;
  border: none;
}

.module-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toggle-label {
  font-size: 11.5px;
  font-weight: 600;
  color: #cbd5e1;
}

.system-chip {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 8px;
  padding: 6px 8px;
}

.gauge-cards-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
}

.gauge-card {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  padding: 6px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.gauge-title {
  font-size: 9.5px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
}

.gauge-value {
  font-size: 11.5px;
  font-weight: 700;
}

.gauge-denom,
.gauge-unit {
  font-size: 9.5px;
  font-weight: 500;
  color: #64748b;
}

.slider-control-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.financials-box {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  box-sizing: border-box;
}

.metric-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}
</style>
