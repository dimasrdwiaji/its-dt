<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useMapStore } from '@/stores/mapStore'
import { useScenarioStore } from '@/stores/scenarioStore'
import catalog from '@/data/intervention_catalog.json'
import * as turf from '@turf/turf'

const mapStore = useMapStore()
const scenarioStore = useScenarioStore()

// Sub-module for building interventions: 'solar' | 'toren' | 'green'
const buildingSubTab = ref<'solar' | 'toren' | 'green'>('solar')

// Ground tool sub-type: 'well' | 'pond'
const groundSubTool = ref<'well' | 'pond'>('well')

const bldg = computed(() => mapStore.selectedBuilding)

const buildingFeature = computed(() => {
  if (!bldg.value || !mapStore.buildingData?.features) return null
  return mapStore.buildingData.features.find((f: any) => f.properties?.id === bldg.value?.id)
})

const buildingName = computed(() => {
  if (!bldg.value) return 'Campus Structure'
  return bldg.value.name || `Building #${bldg.value.id}`
})

const roofAreaM2 = computed(() => Number(bldg.value?.area) || 0)
const heightMeters = computed(() => {
  const h = bldg.value?.height_google || bldg.value?.height_osm || 8
  return Number(Number(h).toFixed(1))
})

// Shared Rooftop Budget (70% max usable area for solar + toren)
const totalUsableRoofM2 = computed(() => Math.round(roofAreaM2.value * 0.70))

// Wall area for greening (perimeter * height * 40%)
const exactPerimeterM = computed(() => {
  if (buildingFeature.value) {
    try {
      const line = turf.polygonToLine(buildingFeature.value as any)
      return Math.round(turf.length(line as any, { units: 'kilometers' }) * 1000)
    } catch (e) {
      // fallback
    }
  }
  return Math.round(4.1 * Math.sqrt(roofAreaM2.value || 100))
})
const maxPlantableFacadeM2 = computed(() => Math.round(exactPerimeterM.value * heightMeters.value * 0.40))

// Existing interventions for this building
const existingSolar = computed(() => bldg.value ? scenarioStore.getBuildingSolar(bldg.value.id) : null)
const existingToren = computed(() => bldg.value ? scenarioStore.getBuildingToren(bldg.value.id) : null)

const solarOccupiedM2 = computed(() => {
  if (!existingSolar.value) return 0
  return Number(existingSolar.value.metadata?.areaOccupiedM2) || (existingSolar.value.quantity * 2.58)
})

const torenOccupiedM2 = computed(() => {
  if (!existingToren.value) return 0
  return Number(existingToren.value.metadata?.areaOccupiedM2) || (existingToren.value.quantity * 2.7)
})

const totalRoofOccupiedM2 = computed(() => Math.round(solarOccupiedM2.value + torenOccupiedM2.value))
const availableRoofM2 = computed(() => Math.max(0, totalUsableRoofM2.value - totalRoofOccupiedM2.value))

// ================= SOLAR PV (from intervention_catalog.json) =================
const solarOptions = computed(() => catalog.solar_pv)
const selectedSolarId = ref(catalog.solar_pv[0].id)
const solarAreaInput = ref(300)

const selectedSolarSpec = computed(() => {
  return solarOptions.value.find(s => s.id === selectedSolarId.value) || solarOptions.value[0]
})

const solarPanelsCount = computed(() => {
  return Math.floor(solarAreaInput.value / selectedSolarSpec.value.area_m2)
})

const solarKwpCapacity = computed(() => {
  return Number(((solarPanelsCount.value * selectedSolarSpec.value.power_wp) / 1000).toFixed(1))
})

const solarCapEx = computed(() => {
  return Math.round(solarKwpCapacity.value * selectedSolarSpec.value.cost_turnkey_per_kwp_idr)
})

const solarAnnualKwh = computed(() => {
  // 1 kWp in Surabaya yields ~1,450 kWh/yr
  return Math.round(solarKwpCapacity.value * 1450)
})

const solarAnnualSavingsIdr = computed(() => {
  return Math.round(solarAnnualKwh.value * catalog.economic_regulatory_params.pln_tariff_idr_per_kwh)
})

const solarSimplePayback = computed(() => {
  if (solarAnnualSavingsIdr.value <= 0) return 0
  return Number((solarCapEx.value / solarAnnualSavingsIdr.value).toFixed(1))
})

// ================= TOREN TANKS (from intervention_catalog.json) =================
const torenOptions = computed(() => catalog.toren_tanks)
const selectedTorenId = ref(catalog.toren_tanks[3].id) // Default 5,000 L
const torenCount = ref(2)

const selectedTorenSpec = computed(() => {
  return torenOptions.value.find(t => t.id === selectedTorenId.value) || torenOptions.value[0]
})

const torenStorageLiters = computed(() => {
  return torenCount.value * selectedTorenSpec.value.capacity_liters
})

const torenRoofAreaUsed = computed(() => {
  const radius = selectedTorenSpec.value.diameter_m / 2
  return Number((torenCount.value * Math.PI * radius * radius).toFixed(1))
})

const torenCapEx = computed(() => {
  return torenCount.value * selectedTorenSpec.value.cost_installed_idr
})

// ================= LIVING WALLS (from intervention_catalog.json) =================
const livingWallSpec = computed(() => {
  return catalog.plants.find(p => p.id === 'vertical_frame_lky') || {
    name: 'Lee Kuan Yew Facade Trellis Frame (Vernonia elliptica)',
    planted_cost_idr: 680000,
    co2_sequestration_kg_yr: 8.5,
    cooling_delta_c: -2.4
  }
})
const greeningAreaInput = ref(150)
const greeningCapEx = computed(() => greeningAreaInput.value * livingWallSpec.value.planted_cost_idr)
const greeningCo2Tons = computed(() => {
  return Number(((greeningAreaInput.value * livingWallSpec.value.co2_sequestration_kg_yr) / 1000).toFixed(2))
})

// ================= ROADSIDE TREES (from intervention_catalog.json) =================
const treeSpeciesOptions = computed(() => {
  return catalog.plants.filter(p => p.category === 'tree' || p.category === 'shrub' || p.category === 'groundcover')
})
const treeQuantity = ref(8)

const selectedTreeSpec = computed(() => {
  return treeSpeciesOptions.value.find(p => p.id === mapStore.selectedTreeSpecies) || treeSpeciesOptions.value[0]
})

const treeTotalCanopyM2 = computed(() => {
  const r = selectedTreeSpec.value.canopy_radius_m || 2.5
  return Number((treeQuantity.value * Math.PI * r * r).toFixed(1))
})

const treeCapEx = computed(() => {
  return treeQuantity.value * (selectedTreeSpec.value.planted_cost_idr || 425000)
})

const treeTotalCo2Kg = computed(() => {
  return Number((treeQuantity.value * (selectedTreeSpec.value.co2_sequestration_kg_yr || 12.5)).toFixed(1))
})

// ================= GROUND & WATER (from intervention_catalog.json) =================
const dryWellSpec = computed(() => catalog.dry_wells[0])
const pondSpec = computed(() => catalog.retention_ponds[0])
const pondAreaM2 = computed(() => mapStore.pendingPond?.areaM2 || 120)
const pondDepthM = ref(1.5)
const pondVolumeM3 = computed(() => Math.round(pondAreaM2.value * pondDepthM.value))
const pondCapEx = computed(() => Math.round(pondVolumeM3.value * pondSpec.value.cost_per_m3_storage_idr))

// ================= ACTIONS =================
function addSolarIntervention() {
  if (!bldg.value) return
  scenarioStore.addIntervention({
    id: `solar_${bldg.value.id}_${Date.now()}`,
    buildingId: bldg.value.id,
    buildingName: buildingName.value,
    module: 'energy',
    type: 'rooftop_pv',
    name: selectedSolarSpec.value.name,
    quantity: solarPanelsCount.value,
    unit: 'panels',
    costIdr: solarCapEx.value,
    energyMWhYr: Number((solarAnnualKwh.value / 1000).toFixed(1)),
    metadata: {
      areaOccupiedM2: solarAreaInput.value,
      kwp: solarKwpCapacity.value,
      modelId: selectedSolarSpec.value.id
    }
  })
}

function addTorenIntervention() {
  if (!bldg.value) return
  scenarioStore.addIntervention({
    id: `toren_${bldg.value.id}_${Date.now()}`,
    buildingId: bldg.value.id,
    buildingName: buildingName.value,
    module: 'hydrology',
    type: 'rooftop_toren',
    name: selectedTorenSpec.value.name,
    quantity: torenCount.value,
    unit: 'units',
    costIdr: torenCapEx.value,
    metadata: {
      areaOccupiedM2: torenRoofAreaUsed.value,
      storageLiters: torenStorageLiters.value,
      modelId: selectedTorenSpec.value.id
    }
  })
}

function addGreeningIntervention() {
  if (!bldg.value) return
  scenarioStore.addIntervention({
    id: `green_${bldg.value.id}_${Date.now()}`,
    buildingId: bldg.value.id,
    buildingName: buildingName.value,
    module: 'ecology',
    type: 'vertical_greening',
    name: livingWallSpec.value.name,
    quantity: greeningAreaInput.value,
    unit: 'm²',
    costIdr: greeningCapEx.value,
    co2OffsetTons: greeningCo2Tons.value
  })
}

function addRoadsideTreesIntervention() {
  scenarioStore.addIntervention({
    id: `trees_${Date.now()}`,
    buildingName: 'Campus Roadside Corridor',
    module: 'ecology',
    type: 'ground_tree',
    name: selectedTreeSpec.value.name,
    quantity: treeQuantity.value,
    unit: selectedTreeSpec.value.category === 'groundcover' ? 'm²' : 'specimens',
    costIdr: treeCapEx.value,
    co2OffsetTons: Number((treeTotalCo2Kg.value / 1000).toFixed(2)),
    metadata: {
      canopyM2: treeTotalCanopyM2.value,
      speciesId: selectedTreeSpec.value.id
    }
  })
}

function addDryWellIntervention() {
  scenarioStore.addIntervention({
    id: `drywell_${Date.now()}`,
    buildingName: 'Campus Infiltration Zone',
    module: 'hydrology',
    type: 'dry_well',
    name: dryWellSpec.value.name,
    quantity: 1,
    unit: 'well',
    costIdr: dryWellSpec.value.cost_installed_idr,
    metadata: {
      volumeM3: dryWellSpec.value.storage_m3
    }
  })
}

function addPondIntervention() {
  scenarioStore.addIntervention({
    id: `pond_${Date.now()}`,
    buildingName: 'Campus Retention Pond',
    module: 'hydrology',
    type: 'retention_pond',
    name: pondSpec.value.name,
    quantity: pondVolumeM3.value,
    unit: 'm³ storage',
    costIdr: pondCapEx.value,
    metadata: {
      areaM2: pondAreaM2.value,
      depthM: pondDepthM.value
    }
  })
}

watch(
  () => mapStore.planTarget,
  (tgt) => {
    if (tgt === 'trees') {
      mapStore.setActiveTool('plant_tree')
    } else if (tgt === 'ground') {
      mapStore.setActiveTool(groundSubTool.value === 'pond' ? 'retention_pond' : 'dry_well')
    } else {
      mapStore.setActiveTool('info')
    }
  }
)

watch(
  () => groundSubTool.value,
  (st) => {
    if (mapStore.planTarget === 'ground') {
      mapStore.setActiveTool(st === 'pond' ? 'retention_pond' : 'dry_well')
    }
  }
)
</script>

<template>
  <aside class="plan-inspector">
    
    <!-- Target Category Segmented Control -->
    <div class="target-segment">
      <button
        type="button"
        class="target-btn"
        :class="{ active: mapStore.planTarget === 'building' }"
        @click="mapStore.setPlanTarget('building')"
      >
        <i class="pi pi-building"></i>
        <span>Buildings</span>
      </button>
      <button
        type="button"
        class="target-btn"
        :class="{ active: mapStore.planTarget === 'trees' }"
        @click="mapStore.setPlanTarget('trees')"
      >
        <i class="pi pi-tree"></i>
        <span>Roadside Trees</span>
      </button>
      <button
        type="button"
        class="target-btn"
        :class="{ active: mapStore.planTarget === 'ground' }"
        @click="mapStore.setPlanTarget('ground')"
      >
        <i class="pi pi-cloud"></i>
        <span>Ground & Water</span>
      </button>
    </div>

    <!-- ================= TARGET 1: BUILDINGS ================= -->
    <div v-if="mapStore.planTarget === 'building'" class="inspector-body">
      
      <!-- When a building is selected -->
      <div v-if="bldg" class="bldg-plan-flow">
        
        <!-- Header -->
        <div class="bldg-header">
          <div class="header-text">
            <span class="bldg-badge">Active Building Target</span>
            <h3 class="bldg-title">{{ buildingName }}</h3>
            <span class="bldg-meta font-mono">Gross Roof: {{ roofAreaM2.toLocaleString('id-ID') }} m²</span>
          </div>
          <button class="btn-clear-bldg" @click="mapStore.setSelectedBuilding(null)" title="Deselect Building">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <!-- Shared Rooftop Budget Capacity Bar -->
        <div class="budget-box">
          <div class="budget-header">
            <span>Shared Rooftop Budget (70% Usable)</span>
            <span class="font-mono">{{ totalRoofOccupiedM2 }} / {{ totalUsableRoofM2 }} m²</span>
          </div>
          <div class="budget-bar-track">
            <div class="bar-solar" :style="{ width: `${Math.min(100, (solarOccupiedM2 / totalUsableRoofM2) * 100)}%` }"></div>
            <div class="bar-toren" :style="{ width: `${Math.min(100, (torenOccupiedM2 / totalUsableRoofM2) * 100)}%` }"></div>
          </div>
          <div class="budget-legend">
            <span><span class="dot bg-solar"></span>Solar: {{ Math.round(solarOccupiedM2) }} m²</span>
            <span><span class="dot bg-hydro"></span>Toren: {{ Math.round(torenOccupiedM2) }} m²</span>
            <span class="text-eco font-medium">Free: {{ availableRoofM2 }} m²</span>
          </div>
        </div>

        <!-- Building Module Subtabs -->
        <div class="module-tabs">
          <button
            type="button"
            class="mod-tab"
            :class="{ active: buildingSubTab === 'solar' }"
            @click="buildingSubTab = 'solar'"
          >
            Solar PV
          </button>
          <button
            type="button"
            class="mod-tab"
            :class="{ active: buildingSubTab === 'toren' }"
            @click="buildingSubTab = 'toren'"
          >
            Toren Cisterns
          </button>
          <button
            type="button"
            class="mod-tab"
            :class="{ active: buildingSubTab === 'green' }"
            @click="buildingSubTab = 'green'"
          >
            Living Walls
          </button>
        </div>

        <!-- Solar Subtab -->
        <div v-if="buildingSubTab === 'solar'" class="subtab-content">
          <div class="form-row">
            <span class="field-label">Solar PV Specification</span>
            <select v-model="selectedSolarId" class="field-select">
              <option v-for="opt in solarOptions" :key="opt.id" :value="opt.id">
                {{ opt.name }} ({{ opt.power_wp }}Wp)
              </option>
            </select>
          </div>

          <div class="form-row">
            <div class="field-label-row">
              <span class="field-label">Rooftop Area Coverage</span>
              <span class="font-mono font-medium">{{ solarAreaInput }} m²</span>
            </div>
            <input
              type="range"
              min="20"
              :max="Math.max(20, availableRoofM2 + Math.round(solarOccupiedM2))"
              v-model.number="solarAreaInput"
              class="range-slider"
            >
            <!-- Physical Unit Conversion Badge -->
            <div class="conversion-badge font-mono">
              <span>Installation Unit Conversion:</span>
              <span class="font-bold">{{ solarPanelsCount }} Panels • {{ solarKwpCapacity }} kWp</span>
            </div>
          </div>

          <div class="impact-summary-box">
            <div class="impact-line">
              <span class="impact-k">Turnkey CapEx:</span>
              <span class="impact-v font-mono">Rp {{ solarCapEx.toLocaleString('id-ID') }}</span>
            </div>
            <div class="impact-line">
              <span class="impact-k">Annual Clean Power:</span>
              <span class="impact-v text-solar font-mono">{{ Number((solarAnnualKwh / 1000).toFixed(1)) }} MWh/yr</span>
            </div>
            <div class="impact-line">
              <span class="impact-k">Annual PLN Savings:</span>
              <span class="impact-v text-eco font-mono">Rp {{ solarAnnualSavingsIdr.toLocaleString('id-ID') }}/yr</span>
            </div>
            <div class="impact-line">
              <span class="impact-k">Simple Payback:</span>
              <span class="impact-v font-mono">{{ solarSimplePayback }} Years</span>
            </div>
          </div>

          <button class="btn-action-primary" @click="addSolarIntervention">
            <i class="pi pi-plus"></i>
            <span>Add Solar to Active Scenario</span>
          </button>
        </div>

        <!-- Toren Subtab -->
        <div v-if="buildingSubTab === 'toren'" class="subtab-content">
          <div class="form-row">
            <span class="field-label">Rainwater Cistern Specification</span>
            <select v-model="selectedTorenId" class="field-select">
              <option v-for="opt in torenOptions" :key="opt.id" :value="opt.id">
                {{ opt.name }} (dia {{ opt.diameter_m }}m)
              </option>
            </select>
          </div>

          <div class="form-row">
            <div class="field-label-row">
              <span class="field-label">Cistern Unit Quantity</span>
              <span class="font-mono font-medium">{{ torenCount }} Units</span>
            </div>
            <input type="range" min="1" max="10" v-model.number="torenCount" class="range-slider">
            <div class="conversion-badge font-mono">
              <span>Unit Conversion:</span>
              <span class="font-bold">{{ torenStorageLiters.toLocaleString('id-ID') }} L Storage • {{ torenRoofAreaUsed }} m² Roof</span>
            </div>
          </div>

          <div class="impact-summary-box">
            <div class="impact-line">
              <span class="impact-k">Installed CapEx:</span>
              <span class="impact-v font-mono">Rp {{ torenCapEx.toLocaleString('id-ID') }}</span>
            </div>
            <div class="impact-line">
              <span class="impact-k">Stormwater Detained:</span>
              <span class="impact-v text-hydro font-mono">{{ Number((torenStorageLiters / 1000).toFixed(1)) }} m³ / event</span>
            </div>
          </div>

          <button class="btn-action-primary" @click="addTorenIntervention">
            <i class="pi pi-plus"></i>
            <span>Add Torens to Active Scenario</span>
          </button>
        </div>

        <!-- Living Wall Subtab -->
        <div v-if="buildingSubTab === 'green'" class="subtab-content">
          <div class="form-row">
            <span class="field-label">Living Wall Specification</span>
            <div class="spec-info-box">
              <span class="spec-name">{{ livingWallSpec.name }}</span>
              <span class="spec-desc font-mono">Trellis Frame with Drip Irrigation • Rp {{ livingWallSpec.planted_cost_idr.toLocaleString('id-ID') }}/m²</span>
            </div>
          </div>

          <div class="form-row">
            <div class="field-label-row">
              <span class="field-label">Facade Greening Coverage</span>
              <span class="font-mono font-medium">{{ greeningAreaInput }} m²</span>
            </div>
            <span class="subtext">Max plantable facade (40% gross wall): {{ maxPlantableFacadeM2 }} m²</span>
            <input type="range" min="20" :max="Math.max(20, maxPlantableFacadeM2)" v-model.number="greeningAreaInput" class="range-slider">
          </div>

          <div class="impact-summary-box">
            <div class="impact-line">
              <span class="impact-k">Estimated CapEx:</span>
              <span class="impact-v font-mono">Rp {{ greeningCapEx.toLocaleString('id-ID') }}</span>
            </div>
            <div class="impact-line">
              <span class="impact-k">Thermal Microclimate:</span>
              <span class="impact-v text-eco font-mono">{{ livingWallSpec.cooling_delta_c }} °C wall cooling</span>
            </div>
            <div class="impact-line">
              <span class="impact-k">Annual CO2 Offset:</span>
              <span class="impact-v font-mono">{{ greeningCo2Tons }} tCO₂ / yr</span>
            </div>
          </div>

          <button class="btn-action-primary" @click="addGreeningIntervention">
            <i class="pi pi-plus"></i>
            <span>Add Greening to Active Scenario</span>
          </button>
        </div>

      </div>

      <!-- When NO building is selected -->
      <div v-else class="empty-prompt">
        <div class="guide-box">
          <i class="pi pi-info-circle text-solar"></i>
          <span>Click any 3D building on the campus map to configure Rooftop Solar PV, Rainwater Torens, or Living Walls.</span>
        </div>
        <div class="empty-state-icon">
          <i class="pi pi-building"></i>
        </div>
        <p class="empty-state-sub">Select a building on the 3D map to view its rooftop budget and configure interventions.</p>
      </div>

    </div>

    <!-- ================= TARGET 2: ROADSIDE TREES ================= -->
    <div v-if="mapStore.planTarget === 'trees'" class="inspector-body">
      <div class="guide-box">
        <i class="pi pi-compass text-eco"></i>
        <span>Click anywhere along a campus road corridor. The tool automatically snaps to the pedestrian verge.</span>
      </div>

      <div class="form-row">
        <span class="field-label">Vegetation Species (from Catalog)</span>
        <select v-model="mapStore.selectedTreeSpecies" class="field-select">
          <option v-for="opt in treeSpeciesOptions" :key="opt.id" :value="opt.id">
            {{ opt.name }} ({{ opt.category }})
          </option>
        </select>
      </div>

      <!-- Toggles -->
      <div class="switch-row">
        <span>Road Curb Snapping</span>
        <label class="switch-toggle">
          <input type="checkbox" v-model="mapStore.snapToRoad">
          <span class="slider-round"></span>
        </label>
      </div>

      <div class="switch-row">
        <span>3D Mesh Tree Model</span>
        <label class="switch-toggle">
          <input type="checkbox" v-model="mapStore.tree3DModel">
          <span class="slider-round"></span>
        </label>
      </div>

      <div class="form-row" style="margin-top: 8px;">
        <div class="field-label-row">
          <span class="field-label">Planting Quantity / Stretch</span>
          <span class="font-mono font-medium">{{ treeQuantity }} {{ selectedTreeSpec.category === 'groundcover' ? 'm²' : 'Trees' }}</span>
        </div>
        <input type="range" min="1" max="40" v-model.number="treeQuantity" class="range-slider">
        <div class="conversion-badge font-mono">
          <span>Spatial Canopy:</span>
          <span class="font-bold">{{ treeTotalCanopyM2 }} m² Shaded Corridor</span>
        </div>
      </div>

      <div class="impact-summary-box">
        <div class="impact-line">
          <span class="impact-k">Planted CapEx:</span>
          <span class="impact-v font-mono">Rp {{ treeCapEx.toLocaleString('id-ID') }}</span>
        </div>
        <div class="impact-line">
          <span class="impact-k">Local Surface Cooling:</span>
          <span class="impact-v text-eco font-mono">{{ selectedTreeSpec.cooling_delta_c }} °C LST cooling</span>
        </div>
        <div class="impact-line">
          <span class="impact-k">Annual CO2 Offset:</span>
          <span class="impact-v font-mono">{{ treeTotalCo2Kg }} kg CO₂ / yr</span>
        </div>
      </div>

      <button class="btn-action-primary" @click="addRoadsideTreesIntervention">
        <i class="pi pi-plus"></i>
        <span>Add Roadside Trees to Scenario</span>
      </button>
    </div>

    <!-- ================= TARGET 3: GROUND & WATER ================= -->
    <div v-if="mapStore.planTarget === 'ground'" class="inspector-body">
      <div class="guide-box">
        <i class="pi pi-cloud text-hydro"></i>
        <span>Place infiltration dry wells or draw retention pond polygons in low-elevation depressions.</span>
      </div>

      <div class="module-tabs">
        <button
          type="button"
          class="mod-tab"
          :class="{ active: groundSubTool === 'well' }"
          @click="groundSubTool = 'well'"
        >
          Infiltration Well
        </button>
        <button
          type="button"
          class="mod-tab"
          :class="{ active: groundSubTool === 'pond' }"
          @click="groundSubTool = 'pond'"
        >
          Retention Pond
        </button>
      </div>

      <!-- Dry Well Option -->
      <div v-if="groundSubTool === 'well'" class="subtab-content">
        <div class="specs-card">
          <div class="specs-title">{{ dryWellSpec.name }}</div>
          <p class="specs-desc">{{ dryWellSpec.components }}</p>
        </div>

        <div class="impact-summary-box">
          <div class="impact-line">
            <span class="impact-k">Storage Volume:</span>
            <span class="impact-v text-hydro font-mono">{{ dryWellSpec.storage_m3 }} m³ / event</span>
          </div>
          <div class="impact-line">
            <span class="impact-k">Installed CapEx:</span>
            <span class="impact-v font-mono">Rp {{ dryWellSpec.cost_installed_idr.toLocaleString('id-ID') }}</span>
          </div>
        </div>

        <button class="btn-action-primary" @click="addDryWellIntervention">
          <i class="pi pi-plus"></i>
          <span>Add Dry Well to Scenario</span>
        </button>
      </div>

      <!-- Retention Pond Option -->
      <div v-if="groundSubTool === 'pond'" class="subtab-content">
        <div class="specs-card">
          <div class="specs-title">{{ pondSpec.name }}</div>
          <p class="specs-desc">{{ pondSpec.components }}</p>
        </div>

        <div class="form-row">
          <div class="field-label-row">
            <span class="field-label">Pond Basin Depth</span>
            <span class="font-mono font-medium">{{ pondDepthM }} m</span>
          </div>
          <input type="range" min="1" max="3" step="0.5" v-model.number="pondDepthM" class="range-slider">
        </div>

        <div class="impact-summary-box">
          <div class="impact-line">
            <span class="impact-k">Detention Volume:</span>
            <span class="impact-v text-hydro font-mono">{{ pondVolumeM3.toLocaleString('id-ID') }} m³</span>
          </div>
          <div class="impact-line">
            <span class="impact-k">Unit CapEx Rate:</span>
            <span class="impact-v font-mono">Rp {{ pondSpec.cost_per_m3_storage_idr.toLocaleString('id-ID') }} / m³</span>
          </div>
          <div class="impact-line">
            <span class="impact-k">Estimated CapEx:</span>
            <span class="impact-v font-mono">Rp {{ pondCapEx.toLocaleString('id-ID') }}</span>
          </div>
        </div>

        <button class="btn-action-primary" @click="addPondIntervention">
          <i class="pi pi-plus"></i>
          <span>Add Retention Pond to Scenario</span>
        </button>
      </div>

    </div>

  </aside>
</template>

<style scoped>
.plan-inspector {
  position: absolute;
  top: 14px;
  right: 14px;
  bottom: 14px;
  width: 360px;
  max-width: calc(100vw - 28px);
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(41, 37, 36, 0.06);
  z-index: 900;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Target Segment */
.target-segment {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border-subtle);
  padding: 4px;
  gap: 4px;
  width: 100%;
  box-sizing: border-box;
}

.target-btn {
  height: 32px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.target-btn:hover {
  color: var(--text-main);
}

.target-btn.active {
  background: #ffffff;
  color: var(--text-main);
  border-color: var(--border-subtle);
  box-shadow: 0 1px 3px rgba(41, 37, 36, 0.06);
}

.inspector-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  box-sizing: border-box;
}

/* Building Vertical Flow */
.bldg-plan-flow {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
}

/* Guide Box */
.guide-box {
  background: #faf9f6;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 11.5px;
  color: var(--text-body);
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.45;
  width: 100%;
  box-sizing: border-box;
}

/* Building Header */
.bldg-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 8px;
  width: 100%;
}

.bldg-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
}

.bldg-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  margin: 2px 0 0;
}

.bldg-meta {
  font-size: 11px;
  color: var(--text-muted);
}

.btn-clear-bldg {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
}

.btn-clear-bldg:hover {
  color: var(--text-main);
}

/* Budget Box */
.budget-box {
  background: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
}

.budget-header {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  display: flex;
  justify-content: space-between;
}

.budget-bar-track {
  height: 8px;
  background: var(--border-strong);
  border-radius: 999px;
  overflow: hidden;
  display: flex;
  width: 100%;
}

.bar-solar { background: var(--solar-accent); }
.bar-toren { background: var(--hydro-accent); }

.budget-legend {
  display: flex;
  justify-content: space-between;
  font-size: 10.5px;
  color: var(--text-muted);
}

.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 4px;
}

.bg-solar { background: var(--solar-accent); }
.bg-hydro { background: var(--hydro-accent); }

/* Module Tabs */
.module-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: var(--bg-subtle);
  border-radius: 6px;
  padding: 2px;
  border: 1px solid var(--border-subtle);
  width: 100%;
  box-sizing: border-box;
}

.mod-tab {
  height: 28px;
  border: none;
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  color: var(--text-muted);
  border-radius: 4px;
  cursor: pointer;
  text-align: center;
}

.mod-tab.active {
  background: #ffffff;
  color: var(--text-main);
  box-shadow: 0 1px 3px rgba(41, 37, 36, 0.06);
}

.subtab-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
}

/* Forms */
.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.field-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.subtext {
  font-size: 10.5px;
  color: var(--text-muted);
}

.field-select {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  font-family: inherit;
  background: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  color: var(--text-main);
  outline: none;
  box-sizing: border-box;
}

.field-select:focus {
  border-color: var(--text-main);
}

.range-slider {
  width: 100%;
  height: 4px;
  accent-color: var(--text-main);
}

.conversion-badge {
  background: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 11px;
  color: var(--text-main);
  display: flex;
  justify-content: space-between;
  width: 100%;
  box-sizing: border-box;
}

.spec-info-box {
  background: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spec-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-main);
}

.spec-desc {
  font-size: 11px;
  color: var(--text-muted);
}

/* Impact Summary */
.impact-summary-box {
  background: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11.5px;
  width: 100%;
  box-sizing: border-box;
}

.impact-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.impact-k {
  color: var(--text-body);
}

.impact-v {
  font-weight: 600;
  color: var(--text-main);
}

.btn-action-primary {
  width: 100%;
  height: 34px;
  background: var(--text-main);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: background 0.15s ease;
  box-sizing: border-box;
}

.btn-action-primary:hover {
  background: #332f2c;
}

/* Switch Row */
.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #f7f5f0;
  font-size: 12px;
  color: var(--text-body);
  width: 100%;
  box-sizing: border-box;
}

.switch-toggle {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
}

.switch-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider-round {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--border-strong);
  transition: 0.15s;
  border-radius: 34px;
}

.slider-round:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.15s;
  border-radius: 50%;
}

input:checked + .slider-round {
  background-color: var(--text-main);
}

input:checked + .slider-round:before {
  transform: translateX(14px);
}

/* Empty Prompt */
.empty-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 20px 0;
  width: 100%;
}

.empty-state-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--bg-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--text-muted);
}

.empty-state-sub {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
  max-width: 260px;
}

.specs-card {
  background: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 10px 12px;
  width: 100%;
  box-sizing: border-box;
}

.specs-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 4px;
}

.specs-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.45;
  margin: 0;
}

.text-solar { color: var(--solar-accent); }
.text-hydro { color: var(--hydro-accent); }
.text-eco { color: var(--eco-accent); }
</style>
