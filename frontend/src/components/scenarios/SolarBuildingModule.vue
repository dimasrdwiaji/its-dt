<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useScenarioStore } from '@/stores/scenarioStore'
import type { BuildingProperties } from '@/types/building'
import type { SolarPanelModel } from '@/types/scenario'
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

const solarModels = ref<SolarPanelModel[]>(rulesData.energy.solar_panels)
const selectedModel = ref<SolarPanelModel>(solarModels.value[1] || solarModels.value[0]) // Default 550Wp

const roofType = ref<'flat' | 'tilted'>('flat')
const packingFactor = computed(() => {
  return roofType.value === 'flat'
    ? rulesData.energy.packing_factors.flat_roof
    : rulesData.energy.packing_factors.tilted_roof
})

// Calculate maximum allowable panels based on roof area, packing factor, and shared roof budget
const effectiveRoofArea = computed(() => {
  const bldgArea = Number(props.building.area) || 0
  const totalUsable = bldgArea * packingFactor.value
  if (props.availableRoofM2 !== undefined) {
    return Math.max(0, Math.min(totalUsable, props.availableRoofM2))
  }
  return totalUsable
})

const maxPanels = computed(() => {
  const panelArea = selectedModel.value?.area_m2 || 2.5
  return Math.max(1, Math.floor(effectiveRoofArea.value / panelArea))
})

const existing = scenarioStore.getBuildingSolar(props.building.id)
const showPanels = ref(!!existing)
const panelCount = ref(existing ? existing.quantity : Math.min(maxPanels.value, Math.round(maxPanels.value * 0.6)))

watch(maxPanels, (newMax) => {
  if (panelCount.value > newMax) {
    panelCount.value = newMax
  }
})

const panelRatio = computed(() => {
  if (maxPanels.value <= 0) return 0
  return panelCount.value / maxPanels.value
})

const areaOccupiedM2 = computed(() => {
  const pArea = selectedModel.value?.area_m2 || 2.5
  return Math.round(panelCount.value * pArea * 10) / 10
})

const minYieldKWh = computed(() => {
  const minAnnual = Number(props.building.pot_energy_min) || 0
  return Math.round(minAnnual * panelRatio.value)
})

const maxYieldKWh = computed(() => {
  const maxAnnual = Number(props.building.pot_energy_max) || 0
  return Math.round(maxAnnual * panelRatio.value)
})

const estimatedKWh = computed(() => {
  const meanAnnual = Number(props.building.pot_energy_mean) || (panelCount.value * (selectedModel.value.power_wp / 1000) * 1280)
  return Math.round(meanAnnual * panelRatio.value)
})

const maxCapacityKWh = computed(() => {
  const meanAnnual = Number(props.building.pot_energy_mean) || (maxPanels.value * (selectedModel.value.power_wp / 1000) * 1280)
  return Math.round(meanAnnual)
})

const installedCapacityKWp = computed(() => {
  return Number(((panelCount.value * selectedModel.value.power_wp) / 1000).toFixed(2))
})

const totalCostIdr = computed(() => {
  return panelCount.value * selectedModel.value.cost_per_panel_idr
})

const PLN_TARIFF = rulesData.energy.grid_params.pln_tariff_idr_per_kwh || 1444.0

const annualSavingsIdr = computed(() => {
  return Math.round(estimatedKWh.value * PLN_TARIFF)
})

const paybackYears = computed(() => {
  if (annualSavingsIdr.value <= 0) return 0
  return Number((totalCostIdr.value / annualSavingsIdr.value).toFixed(1))
})

function saveToScenario() {
  scenarioStore.saveBuildingSolar({
    id: `solar_bldg_${props.building.id}`,
    buildingId: props.building.id,
    buildingName: props.building.name || `Building #${props.building.id}`,
    module: 'energy',
    type: 'solar_rooftop',
    name: `${panelCount.value}x ${selectedModel.value.brand}`,
    quantity: panelCount.value,
    unit: 'panels',
    costIdr: totalCostIdr.value,
    co2OffsetKgYr: Math.round(estimatedKWh.value * (rulesData.energy.grid_params.jamali_emission_factor_kg_per_kwh || 0.79)),
    energyMWhYr: Number((estimatedKWh.value / 1000).toFixed(2)),
    timestamp: Date.now(),
    metadata: {
      showPanels: showPanels.value,
      installedKWp: installedCapacityKWp.value,
      brand: selectedModel.value.brand,
      roofType: roofType.value,
      areaOccupiedM2: areaOccupiedM2.value
    }
  })
}

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

    <!-- Dual Radial Gauge Cards -->
    <div class="gauge-cards-grid">
      <!-- Panel Count Card -->
      <div class="gauge-card">
        <div class="flex align-items-center justify-content-center gap-1">
          <span class="gauge-title">Panel count</span>
          <FormulaTooltip
            title="Maximum Panel Capacity"
            plainWords="Maximum number of solar panels that physically fit onto the remaining usable roof area, accounting for roof tilt geometry and row packing factor spacing."
            formula="N_max = ⌊ (A_usable × Packing Factor) ÷ A_panel ⌋"
            :variables="[
              { name: 'Available Roof', value: `${Math.round(effectiveRoofArea)} m²` },
              { name: 'Packing Factor', value: `${packingFactor} (${roofType})` },
              { name: 'Module Area', value: `${selectedModel.area_m2} m²` }
            ]"
            standard="Surabaya Rooftop PV Packing Factor (0.60 Flat, 0.80 Tilted)"
            source="Master Building Dataset & Solar Panel Specsheet"
          />
        </div>
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
        <div class="flex align-items-center justify-content-center gap-1">
          <span class="gauge-title">Energy Output</span>
          <FormulaTooltip
            title="Annual Solar Energy Output"
            plainWords="Annual AC electricity generation estimated by scaling total rooftop solar potential by the proportion of maximum allowable panels installed."
            formula="E_annual = (N_panels ÷ N_max) × E_building potential  (kWh/yr)"
            :variables="[
              { name: 'Panel Ratio', value: `${(panelRatio * 100).toFixed(0)}%` },
              { name: 'Specific Yield', value: '1,280 kWh/kWp/yr' },
              { name: 'Installed DC', value: `${installedCapacityKWp} kWp` }
            ]"
            standard="SEBE 2m DSM ray-tracing model with hourly Surabaya sun vectors"
            source="SEBE Simulation (Energyyearroof.tif)"
          />
        </div>
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

    <!-- Interactive Slider -->
    <div class="slider-control-section">
      <div class="flex justify-between text-xs text-slate-300 mb-1">
        <span>Installed Panels</span>
        <span class="font-bold text-blue-400">{{ panelCount }} units ({{ areaOccupiedM2 }} m²)</span>
      </div>
      <Slider
        v-model="panelCount"
        :min="1"
        :max="maxPanels"
        class="w-full"
        @change="showPanels && saveToScenario()"
      />
    </div>

    <!-- Parametric Financial & Technical Summary -->
    <div class="financials-box">
      <div class="metric-line">
        <span class="text-slate-400 flex align-items-center">
          Capacity:
          <FormulaTooltip
            title="DC Nameplate Capacity"
            plainWords="Total peak DC power generating capability of the installed solar panel array under Standard Test Conditions."
            formula="Capacity = (N_panels × P_module) ÷ 1,000  (kWp)"
            :variables="[
              { name: 'Panels', value: `${panelCount}` },
              { name: 'Module Rating', value: `${selectedModel.power_wp} Wp` }
            ]"
          />
        </span>
        <span class="font-semibold text-slate-200">{{ installedCapacityKWp }} kWp</span>
      </div>
      <div class="metric-line">
        <span class="text-slate-400 flex align-items-center">
          Estimated CapEx:
          <FormulaTooltip
            title="Rooftop Solar CapEx"
            plainWords="Total turnkey installation and equipment investment, including Tier-1 PV modules, string inverters, aluminum framing, and BOS wiring."
            formula="CapEx = N_panels × Cost_turnkey per panel  (Rp)"
            :variables="[
              { name: 'Panels', value: `${panelCount}` },
              { name: 'Unit Cost', value: `Rp ${selectedModel.cost_per_panel_idr.toLocaleString('id-ID')}` }
            ]"
            source="Commercial Solar Pricing (intervention_rules.json)"
          />
        </span>
        <span class="font-semibold text-slate-200">Rp {{ totalCostIdr.toLocaleString('id-ID') }}</span>
      </div>
      <div class="metric-line">
        <span class="text-slate-400 flex align-items-center">
          Annual PLN Savings:
          <FormulaTooltip
            title="Annual Electricity Bill Savings"
            plainWords="Direct annual expenditure reduction on university electricity bills based on standard PLN commercial tariff."
            formula="Savings = E_annual (kWh) × Tariff_PLN (Rp/kWh)"
            :variables="[
              { name: 'Energy', value: `${estimatedKWh.toLocaleString()} kWh/yr` },
              { name: 'PLN Tariff', value: `Rp ${PLN_TARIFF} / kWh` }
            ]"
            standard="Tarif Tenaga Listrik (TTL) PLN B2/B3 Golongan Bisnis/Pemerintah"
          />
        </span>
        <span class="font-semibold text-emerald-400">Rp {{ annualSavingsIdr.toLocaleString('id-ID') }}</span>
      </div>
      <div class="metric-line">
        <span class="text-slate-400 flex align-items-center">
          Payback Period:
          <FormulaTooltip
            title="Simple Payback Period"
            plainWords="Estimated time in years required for cumulative electricity bill savings to equal the initial capital investment."
            formula="Payback = Total CapEx ÷ Annual Savings  (years)"
            :variables="[
              { name: 'CapEx', value: `Rp ${totalCostIdr.toLocaleString('id-ID')}` },
              { name: 'Annual Savings', value: `Rp ${annualSavingsIdr.toLocaleString('id-ID')}/yr` }
            ]"
          />
        </span>
        <span class="font-semibold text-cyan-400">{{ paybackYears }} years</span>
      </div>
    </div>

    <!-- Action Button -->
    <Button
      label="Update Solar in Scenario"
      icon="pi pi-check"
      size="small"
      class="w-full mt-1"
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
