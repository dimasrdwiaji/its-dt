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
import FormulaTooltip from '@/components/common/FormulaTooltip.vue'
import rulesData from '@/intervention_rules.json'

const props = defineProps<{
  building: BuildingProperties
  availableRoofM2?: number
}>()

const scenarioStore = useScenarioStore()

const torenOptions = ref<TorenOption[]>(rulesData.hydrology.toren_options)
const selectedToren = ref<TorenOption>(torenOptions.value[2] || torenOptions.value[0]) // Default 5,000L

// Tank base footprint area in m²: π * (diameter / 2)²
const tankFootprintM2 = computed(() => {
  const d = selectedToren.value?.diameter_m || 1.85
  return Math.PI * Math.pow(d / 2, 2)
})

// Dynamic maximum units constrained by available roof budget
const maxUnits = computed(() => {
  const avail = props.availableRoofM2 !== undefined ? props.availableRoofM2 : (Number(props.building.area) || 100) * 0.15
  const count = Math.floor(avail / tankFootprintM2.value)
  return Math.max(1, Math.min(20, count))
})

const existing = scenarioStore.getBuildingToren(props.building.id)
const showToren = ref(!!existing)
const torenCount = ref(existing ? existing.quantity : Math.min(maxUnits.value, 2))

watch(maxUnits, (newMax) => {
  if (torenCount.value > newMax) {
    torenCount.value = newMax
  }
})

const areaOccupiedM2 = computed(() => {
  return Math.round(torenCount.value * tankFootprintM2.value * 10) / 10
})

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
  const unitCost = selectedToren.value?.cost_per_panel_idr || selectedToren.value?.cost_idr || 6800000
  return torenCount.value * unitCost
})

function saveToScenario() {
  scenarioStore.saveBuildingToren({
    id: `toren_bldg_${props.building.id}`,
    buildingId: props.building.id,
    buildingName: props.building.name || `Building #${props.building.id}`,
    module: 'hydrology',
    type: 'rooftop_toren',
    name: `${torenCount.value}x ${selectedToren.value.name}`,
    quantity: torenCount.value,
    unit: 'tanks',
    costIdr: totalCostIdr.value,
    co2OffsetKgYr: 0,
    storageM3: totalStorageM3.value,
    timestamp: Date.now(),
    metadata: {
      showToren: showToren.value,
      tankModel: selectedToren.value.name,
      tankCount: torenCount.value,
      capacityM3PerTank: selectedToren.value.capacity_m3,
      totalStorageM3: totalStorageM3.value,
      areaOccupiedM2: areaOccupiedM2.value
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
      <span class="toggle-label">Show rooftop rainwater toren</span>
      <ToggleSwitch v-model="showToren" />
    </div>

    <!-- Toren Model Specification Select -->
    <div class="model-select-row">
      <Select
        v-model="selectedToren"
        :options="torenOptions"
        optionLabel="name"
        placeholder="Select Tank Model"
        class="w-full text-xs"
        size="small"
      />
    </div>

    <!-- Dual Radial Gauges -->
    <!-- Dual Radial Gauges -->
    <div class="gauge-cards-grid">
      <!-- Tank Count Card -->
      <div class="gauge-card">
        <div class="flex align-items-center justify-content-center gap-1">
          <span class="gauge-title">Tank count</span>
          <FormulaTooltip
            title="Maximum Rooftop Tanks"
            plainWords="Maximum number of modular rainwater harvesting tanks that can physically sit on the remaining unallocated roof footprint based on the circular tank base diameter."
            formula="N_tanks = ⌊ A_available ÷ (π × (D ÷ 2)²) ⌋"
            :variables="[
              { name: 'Available Roof', value: `${props.availableRoofM2 !== undefined ? Math.round(props.availableRoofM2) : 50} m²` },
              { name: 'Tank Footprint', value: `${tankFootprintM2.toFixed(2)} m² (D=${selectedToren.diameter_m}m)` }
            ]"
            standard="SNI 03-2453-2002 Rainwater Harvesting & Dead Load Safety Standards"
          />
        </div>
        <RadialGauge
          :value="torenCount"
          :max="maxUnits"
          icon="pi pi-box"
          color="#0284c7"
        />
        <div class="gauge-value text-sky-400">
          {{ torenCount }} <span class="gauge-denom">/ {{ maxUnits }} tanks</span>
        </div>
      </div>

      <!-- Runoff Retained Card -->
      <div class="gauge-card">
        <div class="flex align-items-center justify-content-center gap-1">
          <span class="gauge-title">Runoff Retained</span>
          <FormulaTooltip
            title="Design Storm Runoff Retention"
            plainWords="Percentage of peak roof runoff volume captured by the rooftop toren tanks during a 10-year design storm event."
            formula="Retention (%) = min(100%, (V_storage ÷ V_storm runoff) × 100%)"
            :variables="[
              { name: 'Total Storage', value: `${totalStorageM3} m³` },
              { name: 'Design Storm Runoff', value: `${roofRunoffM3} m³ (10-yr storm 120mm)` }
            ]"
            standard="Surabaya 10-Year Return Period Design Storm Event (120 mm / 2 hr)"
            source="Master Building Hydrologic Analysis"
          />
        </div>
        <RadialGauge
          :value="retainedPercent"
          :max="100"
          icon="pi pi-cloud"
          color="#38bdf8"
        />
        <div class="gauge-value text-blue-400">
          {{ retainedPercent }} <span class="gauge-unit">%</span>
        </div>
      </div>
    </div>

    <!-- Interactive Slider -->
    <div class="slider-control-section">
      <div class="flex justify-between text-xs text-slate-300 mb-1">
        <span>Installed Tanks</span>
        <span class="font-bold text-sky-400">{{ torenCount }} units ({{ areaOccupiedM2 }} m²)</span>
      </div>
      <Slider
        v-model="torenCount"
        :min="1"
        :max="maxUnits"
        class="w-full"
        @change="showToren && saveToScenario()"
      />
    </div>

    <!-- Parametric Financial & Technical Summary -->
    <div class="financials-box">
      <div class="metric-line">
        <span class="text-slate-400 flex align-items-center">
          Active Storage:
          <FormulaTooltip
            title="Total Retention Storage"
            plainWords="Total gross volume of temporary stormwater storage provided by the installed rooftop tanks."
            formula="V_storage = N_tanks × V_unit  (m³)"
            :variables="[
              { name: 'Tanks', value: `${torenCount}` },
              { name: 'Unit Capacity', value: `${selectedToren.capacity_m3} m³ (${selectedToren.capacity_liters.toLocaleString()} L)` }
            ]"
          />
        </span>
        <span class="font-semibold text-sky-400">+{{ totalStorageM3 }} m³</span>
      </div>
      <div class="metric-line">
        <span class="text-slate-400 flex align-items-center">
          Estimated CapEx:
          <FormulaTooltip
            title="Toren Tank Procurement & Installation CapEx"
            plainWords="Turnkey procurement and structural installation cost for polyethylene water tanks and booster connections."
            formula="CapEx = N_tanks × Unit Price_toren  (Rp)"
            :variables="[
              { name: 'Tanks', value: `${torenCount}` },
              { name: 'Unit Price', value: `Rp ${(selectedToren.cost_idr || 0).toLocaleString('id-ID')}` }
            ]"
            source="Commercial Toren Tank Pricing Catalog"
          />
        </span>
        <span class="font-semibold text-slate-200">Rp {{ totalCostIdr.toLocaleString('id-ID') }}</span>
      </div>
    </div>

    <!-- Action Button -->
    <Button
      label="Update Toren in Scenario"
      icon="pi pi-check"
      size="small"
      class="w-full mt-1"
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

.model-select-row {
  margin-top: -2px;
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
