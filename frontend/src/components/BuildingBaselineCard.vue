<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/mapStore'
import * as turf from '@turf/turf'

const mapStore = useMapStore()
const bldg = computed(() => mapStore.selectedBuilding)

const buildingFeature = computed(() => {
  if (!bldg.value || !mapStore.buildingData?.features) return null
  return mapStore.buildingData.features.find((f: any) => f.properties?.id === bldg.value?.id)
})

const buildingName = computed(() => {
  if (!bldg.value) return 'Campus Structure'
  return bldg.value.name || `Building #${bldg.value.id}`
})

const buildingType = computed(() => {
  if (!bldg.value) return 'University Structure'
  return bldg.value.building || 'Academic Facility'
})

const heightMeters = computed(() => {
  if (!bldg.value) return 8.0
  const h = bldg.value.height_google || bldg.value.height_osm || 8
  return Number(Number(h).toFixed(1))
})

const roofAreaM2 = computed(() => {
  return Number(bldg.value?.area) || 0
})

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

const grossWallAreaM2 = computed(() => {
  return Math.round(exactPerimeterM.value * heightMeters.value)
})

const plantableFacadeM2 = computed(() => {
  return Math.round(grossWallAreaM2.value * 0.40)
})

const annualSolarYieldEst = computed(() => {
  return Math.round(roofAreaM2.value * 0.7 * 0.35 * 1.5)
})

function startPlanning() {
  mapStore.setCampusMode('plan')
  mapStore.setPlanTarget('building')
}

function closeCard() {
  mapStore.setSelectedBuilding(null)
}
</script>

<template>
  <aside v-if="bldg" class="baseline-card">
    <div class="card-header">
      <div>
        <span class="card-tag">Baseline Asset Inspection</span>
        <h3 class="bldg-title">{{ buildingName }}</h3>
        <p class="bldg-type">{{ buildingType }}</p>
      </div>
      <button class="btn-close" @click="closeCard" title="Close Card">
        <i class="pi pi-times"></i>
      </button>
    </div>

    <div class="card-body">
      <!-- Geometric Specs -->
      <div class="specs-group">
        <span class="section-label">Spatial & Physical Massing</span>
        
        <div class="data-stat">
          <span class="stat-name">Gross Rooftop Area</span>
          <span class="stat-val font-mono">{{ roofAreaM2.toLocaleString('id-ID', { maximumFractionDigits: 1 }) }} m²</span>
        </div>

        <div class="data-stat">
          <span class="stat-name">Max Usable Solar/Toren (70%)</span>
          <span class="stat-val font-mono text-solar">{{ Math.round(roofAreaM2 * 0.7).toLocaleString('id-ID') }} m²</span>
        </div>

        <div class="data-stat">
          <span class="stat-name">Building Height</span>
          <span class="stat-val font-mono">{{ heightMeters }} m (~{{ Math.max(1, Math.round(heightMeters / 4)) }} floors)</span>
        </div>

        <div class="data-stat">
          <span class="stat-name">Plantable Facade (40% wall)</span>
          <span class="stat-val font-mono text-eco">{{ plantableFacadeM2.toLocaleString('id-ID') }} m²</span>
        </div>
      </div>

      <!-- Baseline Potentials -->
      <div class="specs-group">
        <span class="section-label">Environmental Baselines</span>

        <div class="data-stat">
          <span class="stat-name">Annual Rooftop Solar Potential</span>
          <span class="stat-val font-mono text-solar">~{{ annualSolarYieldEst.toLocaleString('id-ID') }} MWh/yr</span>
        </div>

        <div class="data-stat">
          <span class="stat-name">Catchment Stormwater Risk</span>
          <span class="stat-val font-mono text-hydro">Moderate Vulnerability</span>
        </div>
      </div>

      <!-- Planning CTA -->
      <div class="cta-box">
        <p class="cta-text">
          Want to simulate Rooftop Solar PV, Rainwater Torens, or Living Walls on this asset?
        </p>
        <button class="btn-plan" @click="startPlanning">
          <i class="pi pi-pencil"></i>
          <span>Plan Interventions on this Building</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.baseline-card {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 330px;
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(41, 37, 36, 0.06);
  z-index: 900;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.card-tag {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.bldg-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  margin: 2px 0 0;
}

.bldg-type {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0;
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  font-size: 12px;
}

.btn-close:hover {
  color: var(--text-main);
}

.card-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.specs-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.data-stat {
  background: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11.5px;
}

.stat-name {
  color: var(--text-body);
}

.stat-val {
  font-weight: 600;
  color: var(--text-main);
}

.cta-box {
  background: #faf9f6;
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

.cta-text {
  font-size: 11.5px;
  color: var(--text-muted);
  margin: 0 0 10px;
  line-height: 1.4;
}

.btn-plan {
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
}

.btn-plan:hover {
  background: #332f2c;
}

.text-solar { color: var(--solar-accent); }
.text-hydro { color: var(--hydro-accent); }
.text-eco { color: var(--eco-accent); }
</style>
