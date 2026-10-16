<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/mapStore'
import { useScenarioStore } from '@/stores/scenarioStore'
import SolarBuildingModule from '@/components/scenarios/SolarBuildingModule.vue'
import EcologyBuildingModule from '@/components/scenarios/EcologyBuildingModule.vue'
import HydrologyBuildingModule from '@/components/scenarios/HydrologyBuildingModule.vue'
import FormulaTooltip from '@/components/common/FormulaTooltip.vue'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Divider from 'primevue/divider'
import * as turf from '@turf/turf'

const mapStore = useMapStore()
const scenarioStore = useScenarioStore()
const bldg = computed(() => mapStore.selectedBuilding)

const buildingFeature = computed(() => {
  if (!bldg.value || !mapStore.buildingData?.features) return null
  return mapStore.buildingData.features.find((f: any) => f.properties?.id === bldg.value?.id)
})

const buildingName = computed(() => {
  if (!bldg.value) return 'Unknown Building'
  return bldg.value.name || `Building #${bldg.value.id}`
})

const buildingType = computed(() => {
  if (!bldg.value) return 'Campus Structure'
  return bldg.value.building || 'University Structure'
})

const heightMeters = computed(() => {
  if (!bldg.value) return 8.0
  const h = bldg.value.height_google || bldg.value.height_osm || 8
  return Number(Number(h).toFixed(1))
})

const roofAreaM2 = computed(() => {
  return Number(bldg.value?.area) || 0
})

const formattedArea = computed(() => {
  return `${roofAreaM2.value.toLocaleString('id-ID', { maximumFractionDigits: 1 })} m²`
})

// Exact polygon boundary perimeter in meters using Turf.js for arbitrary non-rectangular buildings
const exactPerimeterM = computed(() => {
  if (buildingFeature.value) {
    try {
      const line = turf.polygonToLine(buildingFeature.value as any)
      const lenKm = turf.length(line as any, { units: 'kilometers' })
      return Math.round(lenKm * 1000)
    } catch (e) {
      // fallback
    }
  }
  return Math.round(4.1 * Math.sqrt(roofAreaM2.value || 100))
})

// Gross wall area and net plantable facade
const grossWallAreaM2 = computed(() => {
  return Math.round(exactPerimeterM.value * heightMeters.value)
})

const netPlantableFacadeM2 = computed(() => {
  return Math.round(grossWallAreaM2.value * 0.40)
})

// Shared Rooftop Space Budget: Usable roof area
const PACKING_FACTOR = 0.70 // Average packing factor
const totalUsableRoofAreaM2 = computed(() => {
  return Math.round(roofAreaM2.value * PACKING_FACTOR)
})

// Active interventions sharing the roof
const existingSolar = computed(() => {
  return bldg.value ? scenarioStore.getBuildingSolar(bldg.value.id) : null
})

const existingToren = computed(() => {
  return bldg.value ? scenarioStore.getBuildingToren(bldg.value.id) : null
})

const solarOccupiedAreaM2 = computed(() => {
  if (!existingSolar.value) return 0
  return Number(existingSolar.value.metadata?.areaOccupiedM2) || (existingSolar.value.quantity * 2.5)
})

const torenOccupiedAreaM2 = computed(() => {
  if (!existingToren.value) return 0
  return Number(existingToren.value.metadata?.areaOccupiedM2) || (existingToren.value.quantity * 2.7)
})

// Cross-reactivity: remaining space available for each module
const availableRoofForSolar = computed(() => {
  return Math.max(0, totalUsableRoofAreaM2.value - torenOccupiedAreaM2.value)
})

const availableRoofForToren = computed(() => {
  return Math.max(0, totalUsableRoofAreaM2.value - solarOccupiedAreaM2.value)
})

const unallocatedRoofAreaM2 = computed(() => {
  return Math.max(0, totalUsableRoofAreaM2.value - solarOccupiedAreaM2.value - torenOccupiedAreaM2.value)
})

const solarPct = computed(() => {
  if (totalUsableRoofAreaM2.value <= 0) return 0
  return Math.min(100, Math.round((solarOccupiedAreaM2.value / totalUsableRoofAreaM2.value) * 100))
})

const torenPct = computed(() => {
  if (totalUsableRoofAreaM2.value <= 0) return 0
  return Math.min(100, Math.round((torenOccupiedAreaM2.value / totalUsableRoofAreaM2.value) * 100))
})

const unallocatedPct = computed(() => {
  return Math.max(0, 100 - solarPct.value - torenPct.value)
})

// Metrics
const specificYield = computed(() => {
  if (!bldg.value || !bldg.value.area) return '1,280'
  const kwp = Number(bldg.value.area) * 0.2
  const yieldVal = Number(bldg.value.pot_energy_mean) / kwp
  return Math.round(yieldVal).toLocaleString('id-ID')
})

const annualYieldMWh = computed(() => {
  if (!bldg.value) return '0'
  return (Number(bldg.value.pot_energy_mean) / 1000).toFixed(1)
})

const shadingPercent = computed(() => {
  if (!bldg.value) return '0.0%'
  return `${(Number(bldg.value.l_shade_mean) * 100).toFixed(1)}%`
})

const runoffVolume = computed(() => {
  if (!bldg.value) return '0'
  return Number(bldg.value.roof_runoff_vol_m3).toFixed(1)
})

const effectiveHydrology = computed(() => {
  if (!bldg.value) {
    return {
      baselineRoofRunoffM3: 0,
      netRoofRunoffM3: 0,
      roofRetentionPct: 0,
      torenStorageM3: 0,
      groundReliefM3: 0,
      baselineAdjacentFlowM3: 0,
      effectiveAdjacentFlowM3: 0,
      baselineLevel: 'Low',
      effectiveLevel: 'Low',
      isDowngraded: false,
      isMitigated: false
    }
  }
  return scenarioStore.getBuildingEffectiveHydrology(bldg.value.id, bldg.value)
})

const effectiveFloodSeverity = computed(() => {
  const lvl = effectiveHydrology.value.isDowngraded
    ? effectiveHydrology.value.effectiveLevel
    : effectiveHydrology.value.baselineLevel
  switch (lvl) {
    case 'Critical': return 'danger'
    case 'High': return 'warn'
    case 'Medium': return 'info'
    default: return 'success'
  }
})

function closeCard() {
  mapStore.setSelectedBuilding(null)
}
</script>

<template>
  <div v-if="bldg" class="building-info-card">
    <!-- Header -->
    <div class="card-header">
      <div class="header-left">
        <h2 class="building-name">{{ buildingName }}</h2>
        <span class="building-sub">{{ buildingType }}</span>
      </div>
      <Button
        icon="pi pi-times"
        text
        rounded
        size="small"
        @click="closeCard"
      />
    </div>

    <!-- Stat Chips Grid: Clean Height & Area -->
    <div class="stat-chips-grid">
      <div class="stat-chip">
        <span class="chip-label">Building Height</span>
        <span class="chip-value">{{ heightMeters }} m</span>
      </div>
      <div class="stat-chip">
        <span class="chip-label">Roof Area</span>
        <span class="chip-value">{{ formattedArea }}</span>
      </div>
    </div>

    <!-- Live Roof Footprint Budget Segmented Bar -->
    <div class="roof-budget-card">
      <div class="flex justify-between align-items-center mb-1">
        <div class="flex align-items-center gap-1">
          <span class="budget-title">Rooftop Space Allocation</span>
          <FormulaTooltip
            title="Shared Rooftop Space Constraint"
            plainWords="Rooftop usable footprint is capped at 70% of gross roof area for safety parapets, structural setbacks, and maintenance pathways. Solar photovoltaic arrays and rainwater toren tanks compete for this same physical surface."
            formula="A_usable = A_roof × 0.70  where  A_solar + A_toren ≤ A_usable"
            :variables="[
              { name: 'Total Usable Roof', value: `${totalUsableRoofAreaM2} m² (70% net factor)` },
              { name: 'Solar Panels Area', value: `${Math.round(solarOccupiedAreaM2)} m² (${solarPct}%)` },
              { name: 'Rainwater Tanks Area', value: `${Math.round(torenOccupiedAreaM2)} m² (${torenPct}%)` },
              { name: 'Unallocated Space', value: `${Math.round(unallocatedRoofAreaM2)} m² (${unallocatedPct}%)` }
            ]"
            standard="Spatial Mutual Exclusion & Rooftop Maintenance Clearance Standard"
          />
        </div>
        <span class="text-xs text-slate-400">{{ totalUsableRoofAreaM2 }} m² usable</span>
      </div>

      <!-- Segmented Bar -->
      <div class="segmented-bar">
        <div
          v-if="solarPct > 0"
          class="bar-segment bar-solar"
          :style="{ width: `${solarPct}%` }"
          title="Solar Panels"
        ></div>
        <div
          v-if="torenPct > 0"
          class="bar-segment bar-toren"
          :style="{ width: `${torenPct}%` }"
          title="Toren Tanks"
        ></div>
        <div
          v-if="unallocatedPct > 0"
          class="bar-segment bar-unallocated"
          :style="{ width: `${unallocatedPct}%` }"
          title="Available Unallocated"
        ></div>
      </div>

      <!-- Legend for Bar -->
      <div class="flex justify-between text-xs mt-1 text-slate-400">
        <span class="flex align-items-center gap-1">
          <span class="dot dot-solar"></span> Solar: {{ Math.round(solarOccupiedAreaM2) }} m²
        </span>
        <span class="flex align-items-center gap-1">
          <span class="dot dot-toren"></span> Toren: {{ Math.round(torenOccupiedAreaM2) }} m²
        </span>
        <span class="flex align-items-center gap-1">
          <span class="dot dot-avail"></span> Free: {{ Math.round(unallocatedRoofAreaM2) }} m²
        </span>
      </div>
    </div>

    <Divider class="my-1" />

    <!-- General Building Environmental Metrics Overview -->
    <div class="metrics-list">
      <div class="metric-row">
        <span class="metric-label">
          <i class="pi pi-bolt mr-2 text-yellow-500"></i>
          Specific PV Yield
          <FormulaTooltip
            title="Specific Photovoltaic Yield"
            plainWords="Annual electrical energy output normalized per kilowatt-peak (kWp) of installed photovoltaic capacity under Surabaya climatic conditions."
            formula="Yield = Annual Generation (kWh) ÷ Installed Capacity (kWp)"
            :variables="[
              { name: 'Annual Mean', value: `${annualYieldMWh} MWh/yr` },
              { name: 'Standard Capacity', value: `${(roofAreaM2 * 0.2).toFixed(1)} kWp` }
            ]"
            standard="Surabaya Global Horizontal Irradiance (GHI) Standard"
            source="SEBE Solar Modeling on 2m Combined DSM"
          />
        </span>
        <span class="metric-value">{{ specificYield }} kWh/kWp/yr</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">
          <i class="pi pi-sun mr-2 text-orange-500"></i>
          Mean Solar Potential
          <FormulaTooltip
            title="Mean Building Rooftop Solar Potential"
            plainWords="Annual cumulative solar electricity generation across the entire rooftop calculated from 8,760 hours of ray-traced solar irradiance, incorporating system efficiency and performance ratio."
            formula="E_PV = ∑ (GTI_pixel × η_system × PR) ÷ 1,000  (MWh/yr)"
            :variables="[
              { name: 'Performance Ratio', value: '0.75' },
              { name: 'Module Efficiency', value: '20.0%' }
            ]"
            source="Energyyearroof.tif SEBE Simulation"
          />
        </span>
        <span class="metric-value font-semibold text-primary">{{ annualYieldMWh }} MWh/yr</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">
          <i class="pi pi-building mr-2 text-green-500"></i>
          Roof Shading Loss
          <FormulaTooltip
            title="Roof Shadow Casting Loss"
            plainWords="Percentage of theoretical daylight hours obstructed by neighboring taller buildings, vegetation, and surrounding terrain throughout the year."
            formula="Shading Loss = (Shaded Hours ÷ Daylight Hours) × 100%"
            :variables="[
              { name: 'Mean Shaded Ratio', value: `${shadingPercent}` }
            ]"
            source="Ray-traced shadow casting across 365 daily solar azimuth angles"
          />
        </span>
        <span class="metric-value">{{ shadingPercent }}</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">
          <i class="pi pi-cloud mr-2 text-blue-400"></i>
          Storm Roof Runoff
          <FormulaTooltip
            title="Peak Storm Roof Runoff Volume"
            plainWords="Total volume of rainwater discharging off the roof during a 2-hour design storm computed using the standard Rational Hydrologic Method, net of rooftop toren rainwater harvesting."
            formula="Q_net = max(0, C × I × A_roof - V_toren)  (m³)"
            :variables="[
              { name: 'Runoff Coef C', value: '0.90 (Impervious Concrete/Metal)' },
              { name: 'Rainfall Intensity I', value: '120 mm (0.12 m, Surabaya 10-yr storm)' },
              { name: 'Roof Area', value: `${roofAreaM2} m²` },
              { name: 'Toren Retention', value: `${effectiveHydrology.torenStorageM3} m³` }
            ]"
            standard="Rational Method (SNI 2415:2016 Hydrologic Flood Calculation)"
          />
        </span>
        <span class="metric-value">
          <template v-if="effectiveHydrology.roofRetentionPct > 0">
            <span class="text-xs text-slate-400 line-through mr-1">{{ runoffVolume }}</span>
            <span class="text-emerald-400 font-bold">{{ effectiveHydrology.netRoofRunoffM3 }} m³</span>
            <span class="text-[10px] text-emerald-400 ml-1">(-{{ effectiveHydrology.roofRetentionPct }}%)</span>
          </template>
          <template v-else>
            {{ runoffVolume }} m³
          </template>
        </span>
      </div>

      <div class="metric-row">
        <span class="metric-label">
          <i class="pi pi-exclamation-triangle mr-2 text-red-400"></i>
          Adjacent Flood Risk
          <FormulaTooltip
            title="Adjacent Flood Vulnerability & Relief Formulation"
            plainWords="Current condition on page load reflects baseline unmitigated overland runoff from upstream DEMNAS terrain. Installing rooftop torens or placing nearby modular dry wells (45m radius) or retention ponds (120m radius) intercepts runoff, attenuating perimeter flood hazard flow and downgrading the risk level."
            formula="Q_eff = max(0, Q_baseline - V_toren - ∑ V_ground × (1 - d/R))"
            :variables="[
              { name: 'Current Baseline Level', value: `${effectiveHydrology.baselineLevel} (${effectiveHydrology.baselineAdjacentFlowM3} m³)` },
              { name: 'Ground Infiltration Relief', value: `${effectiveHydrology.groundReliefM3} m³` },
              { name: 'Net Effective Overland Flow', value: `${effectiveHydrology.effectiveAdjacentFlowM3} m³` },
              { name: 'Downgrade Thresholds', value: 'Critical (≥50m³), High (≥20m³), Medium (≥5m³), Low (<5m³)' }
            ]"
            source="SNI 8456:2017 & DEMNAS D8 Pit-Filled Flow Routing"
          />
        </span>
        <div class="flex items-center gap-1">
          <Tag
            v-if="effectiveHydrology.isDowngraded"
            :value="`${effectiveHydrology.baselineLevel} → ${effectiveHydrology.effectiveLevel}`"
            severity="success"
            size="small"
          />
          <Tag
            v-else
            :value="effectiveHydrology.baselineLevel"
            :severity="effectiveFloodSeverity"
            size="small"
          />
        </div>
      </div>
    </div>

    <Divider class="my-1" />

    <!-- Multi-Intervention Accordions Section -->
    <div class="interventions-accordion-section">
      <div class="section-title-row mb-2">
        <span class="section-heading">BUILDING INTERVENTIONS</span>
        <span class="section-subheading">Configure multiple modules simultaneously</span>
      </div>

      <Accordion :value="['solar']" multiple class="building-accordions">
        
        <!-- Tab 1: Rooftop Solar PV -->
        <AccordionPanel value="solar">
          <AccordionHeader>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-sun text-yellow-400 text-xs"></i>
              <span class="text-xs font-semibold">Rooftop Solar PV</span>
              <Tag
                v-if="existingSolar"
                value="Installed"
                severity="warn"
                class="ml-auto text-xs py-0 px-1"
              />
            </div>
          </AccordionHeader>
          <AccordionContent>
            <SolarBuildingModule
              :building="bldg"
              :availableRoofM2="availableRoofForSolar"
            />
          </AccordionContent>
        </AccordionPanel>

        <!-- Tab 2: Vertical Greening (Facade) -->
        <AccordionPanel value="ecology">
          <AccordionHeader>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-leaf text-green-400 text-xs"></i>
              <span class="text-xs font-semibold">Vertical Greening (Facade)</span>
              <Tag
                v-if="scenarioStore.getBuildingGreening(bldg.id)"
                value="Installed"
                severity="success"
                class="ml-auto text-xs py-0 px-1"
              />
            </div>
          </AccordionHeader>
          <AccordionContent>
            <EcologyBuildingModule
              :building="bldg"
              :exactPerimeterM="exactPerimeterM"
            />
          </AccordionContent>
        </AccordionPanel>

        <!-- Tab 3: Rooftop Rainwater Toren -->
        <AccordionPanel value="hydrology">
          <AccordionHeader>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-box text-sky-400 text-xs"></i>
              <span class="text-xs font-semibold">Rooftop Rainwater Toren</span>
              <Tag
                v-if="existingToren"
                value="Installed"
                severity="info"
                class="ml-auto text-xs py-0 px-1"
              />
            </div>
          </AccordionHeader>
          <AccordionContent>
            <HydrologyBuildingModule
              :building="bldg"
              :availableRoofM2="availableRoofForToren"
            />
          </AccordionContent>
        </AccordionPanel>

      </Accordion>
    </div>
  </div>
</template>

<style scoped>
.building-info-card {
  position: absolute;
  top: 68px;
  right: 12px;
  width: 375px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 84px);
  overflow-y: auto;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 12px;
  padding: 14px;
  z-index: 1000;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.building-name {
  font-size: 14px;
  font-weight: 700;
  color: #f8fafc;
  margin: 0;
  line-height: 1.25;
}

.building-sub {
  font-size: 10.5px;
  color: #94a3b8;
  display: block;
  margin-top: 2px;
}

.stat-chips-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stat-chip {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
}

.chip-label {
  font-size: 9.5px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.chip-value {
  font-size: 12.5px;
  font-weight: 700;
  color: #f1f5f9;
  margin-top: 2px;
}

.roof-budget-card {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.budget-title {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.segmented-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.15);
}

.bar-segment {
  height: 100%;
  transition: width 0.3s ease;
}

.bar-solar {
  background: #f59e0b;
}

.bar-toren {
  background: #0284c7;
}

.bar-unallocated {
  background: #475569;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.dot-solar {
  background: #f59e0b;
}

.dot-toren {
  background: #0284c7;
}

.dot-avail {
  background: #64748b;
}

.metrics-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.metric-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
}

.metric-label {
  color: #94a3b8;
  display: flex;
  align-items: center;
}

.metric-value {
  color: #f1f5f9;
  font-weight: 500;
}

.interventions-accordion-section {
  display: flex;
  flex-direction: column;
}

.section-title-row {
  display: flex;
  flex-direction: column;
}

.section-heading {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
}

.section-subheading {
  font-size: 9.5px;
  color: #64748b;
}

.building-accordions :deep(.p-accordioncontent-content) {
  padding: 8px 8px !important;
}
</style>
