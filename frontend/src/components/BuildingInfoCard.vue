<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/mapStore'
import SolarBuildingModule from '@/components/scenarios/SolarBuildingModule.vue'
import EcologyBuildingModule from '@/components/scenarios/EcologyBuildingModule.vue'
import HydrologyBuildingModule from '@/components/scenarios/HydrologyBuildingModule.vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Divider from 'primevue/divider'

const mapStore = useMapStore()
const bldg = computed(() => mapStore.selectedBuilding)

const buildingName = computed(() => {
  if (!bldg.value) return 'Unknown Building'
  return bldg.value.name || `Building #${bldg.value.id}`
})

const buildingType = computed(() => {
  if (!bldg.value) return 'Campus Structure'
  return bldg.value.building || 'University Structure'
})

const heightMeters = computed(() => {
  if (!bldg.value) return '8.0 m'
  const h = bldg.value.height_google || bldg.value.height_osm || 8
  return `${Number(h).toFixed(1)} m`
})

const formattedArea = computed(() => {
  if (!bldg.value) return '0 m²'
  return `${Number(bldg.value.area).toLocaleString('en-US', { maximumFractionDigits: 1 })} m²`
})

const energyMinMWh = computed(() => {
  if (!bldg.value) return '0'
  return (Number(bldg.value.pot_energy_min) / 1000).toFixed(1)
})

const energyMaxMWh = computed(() => {
  if (!bldg.value) return '0'
  return (Number(bldg.value.pot_energy_max) / 1000).toFixed(1)
})

const annualYieldMWh = computed(() => {
  if (!bldg.value) return '0'
  return (Number(bldg.value.pot_energy_mean) / 1000).toFixed(1)
})

const specificYield = computed(() => {
  if (!bldg.value || !bldg.value.area) return '1,280'
  const kwp = Number(bldg.value.area) * 0.2
  const yieldVal = Number(bldg.value.pot_energy_mean) / kwp
  return Math.round(yieldVal).toLocaleString('en-US')
})

const shadingPercent = computed(() => {
  if (!bldg.value) return '0.0%'
  return `${(Number(bldg.value.l_shade_mean) * 100).toFixed(1)}%`
})

const runoffVolume = computed(() => {
  if (!bldg.value) return '0'
  return Number(bldg.value.roof_runoff_vol_m3).toFixed(1)
})

const floodRisk = computed(() => {
  if (!bldg.value) return 'Low'
  return bldg.value.flood_risk_level || 'Low'
})

const floodSeverity = computed(() => {
  switch (floodRisk.value) {
    case 'Critical': return 'danger'
    case 'High': return 'warn'
    case 'Medium': return 'info'
    default: return 'success'
  }
})

// Dynamic gauge bar adapting to mapStore.colorMode
const activeGaugeConfig = computed(() => {
  if (!bldg.value) return null

  switch (mapStore.colorMode) {
    case 'energy': {
      const val = Number(bldg.value.pot_energy_mean) || 0
      const pct = Math.min(100, Math.max(0, ((val - 50000) / (1200000 - 50000)) * 100))
      return {
        title: 'Solar Energy Potential',
        gradient: 'linear-gradient(to right, #fef08a, #f97316, #dc2626)',
        percent: pct,
        minLabel: 'Low (50 MWh)',
        maxLabel: 'High (1,200+ MWh)'
      }
    }
    case 'ecology': {
      const val = Number(bldg.value.l_shade_mean) || 0
      const pct = Math.min(100, Math.max(0, (val / 0.5) * 100))
      return {
        title: 'Roof Shading Loss',
        gradient: 'linear-gradient(to right, #bbf7d0, #16a34a, #14532d)',
        percent: pct,
        minLabel: 'Low Shade (0%)',
        maxLabel: 'Dense Shade (50%+)'
      }
    }
    case 'hydrology': {
      const val = Number(bldg.value.adjacent_flood_risk_m3) || 0
      const pct = Math.min(100, Math.max(0, (val / 150) * 100))
      return {
        title: 'Adjacent Flood Vulnerability',
        gradient: 'linear-gradient(to right, #bae6fd, #0284c7, #1e3a5f)',
        percent: pct,
        minLabel: 'Low (0 m³)',
        maxLabel: 'High (150+ m³)'
      }
    }
    default: {
      const area = Number(bldg.value.area) || 0
      const pct = Math.min(100, Math.max(0, ((area - 100) / (4000 - 100)) * 100))
      return {
        title: 'Building Footprint Scale',
        gradient: 'linear-gradient(to right, #94a3b8, #cbd5e1, #f8fafc)',
        percent: pct,
        minLabel: 'Compact (<100 m²)',
        maxLabel: 'Large (4,000+ m²)'
      }
    }
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
      <div class="flex align-items-center gap-2">
        <span class="lod-tag">LoD1</span>
        <Button
          icon="pi pi-times"
          text
          rounded
          size="small"
          class="close-btn"
          @click="closeCard"
        />
      </div>
    </div>

    <!-- Stat Chips Grid: Clean height without floor derivation -->
    <div class="stat-chips-grid">
      <div class="stat-chip">
        <span class="chip-label">Building Height</span>
        <span class="chip-value">{{ heightMeters }}</span>
      </div>
      <div class="stat-chip">
        <span class="chip-label">Roof Area</span>
        <span class="chip-value">{{ formattedArea }}</span>
      </div>
    </div>

    <Divider class="my-2" />

    <!-- General Building Metrics Overview -->
    <div class="metrics-list">
      <div class="metric-row">
        <span class="metric-label">
          <i class="pi pi-bolt mr-2 text-yellow-500"></i>
          Specific PV Yield
        </span>
        <span class="metric-value">{{ specificYield }} kWh/kWp/yr</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">
          <i class="pi pi-sun mr-2 text-orange-500"></i>
          Mean Solar Potential
        </span>
        <span class="metric-value font-semibold text-primary">{{ annualYieldMWh }} MWh/yr</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">
          <i class="pi pi-tree mr-2 text-green-500"></i>
          Roof Shading Loss
        </span>
        <span class="metric-value">{{ shadingPercent }}</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">
          <i class="pi pi-cloud mr-2 text-blue-400"></i>
          Storm Roof Runoff
        </span>
        <span class="metric-value">{{ runoffVolume }} m³</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">
          <i class="pi pi-exclamation-triangle mr-2 text-red-400"></i>
          Adjacent Flood Risk
        </span>
        <Tag :value="floodRisk" :severity="floodSeverity" size="small" />
      </div>
    </div>

    <Divider class="my-2" />

    <!-- Module-Adaptive Gauge Bar -->
    <div v-if="activeGaugeConfig" class="potential-section">
      <div class="potential-header">
        <span class="potential-title">{{ activeGaugeConfig.title }}</span>
      </div>
      <div
        class="gradient-progress-bar"
        :style="{ background: activeGaugeConfig.gradient }"
      >
        <div
          class="progress-marker"
          :style="{ left: `${activeGaugeConfig.percent}%` }"
        ></div>
      </div>
      <div class="potential-labels">
        <span>{{ activeGaugeConfig.minLabel }}</span>
        <span>{{ activeGaugeConfig.maxLabel }}</span>
      </div>
    </div>

    <Divider class="my-2" />

    <!-- Module-Specific What-If Interaction Section -->
    <div class="interactive-section">
      <!-- Solar Module: Panel slider & dual dials -->
      <SolarBuildingModule
        v-if="mapStore.colorMode === 'energy'"
        :building="bldg"
      />

      <!-- Ecology Module: Singapore-style vertical greening -->
      <EcologyBuildingModule
        v-else-if="mapStore.colorMode === 'ecology'"
        :building="bldg"
      />

      <!-- Hydrology Module: Rooftop Toren with multiple capacities -->
      <HydrologyBuildingModule
        v-else-if="mapStore.colorMode === 'hydrology'"
        :building="bldg"
      />

      <!-- Default Mode: Quick Jump Buttons -->
      <div v-else class="flex flex-column gap-2">
        <span class="text-xs text-slate-400 mb-1">Select a module to simulate interventions:</span>
        <div class="flex gap-2">
          <Button
            label="Solar PV"
            icon="pi pi-sun"
            size="small"
            severity="warning"
            outlined
            class="flex-1"
            @click="mapStore.setColorMode('energy')"
          />
          <Button
            label="Green Wall"
            icon="pi pi-leaf"
            size="small"
            severity="success"
            outlined
            class="flex-1"
            @click="mapStore.setColorMode('ecology')"
          />
          <Button
            label="Toren"
            icon="pi pi-box"
            size="small"
            severity="info"
            outlined
            class="flex-1"
            @click="mapStore.setColorMode('hydrology')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.building-info-card {
  position: absolute;
  top: 68px;
  right: 12px;
  width: 345px;
  max-height: calc(100vh - 84px);
  overflow-y: auto;
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 12px;
  padding: 16px;
  z-index: 1000;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  font-size: 15px;
  font-weight: 700;
  color: #f8fafc;
  margin: 0;
  line-height: 1.25;
}

.building-sub {
  font-size: 11px;
  color: #94a3b8;
  display: block;
  margin-top: 2px;
}

.lod-tag {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
}

.stat-chips-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 4px;
}

.stat-chip {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
}

.chip-label {
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.chip-value {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
  margin-top: 2px;
}

.metrics-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
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

.potential-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.potential-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.gradient-progress-bar {
  height: 8px;
  border-radius: 4px;
  position: relative;
  overflow: visible;
  transition: background 0.3s ease;
}

.progress-marker {
  position: absolute;
  top: -3px;
  width: 4px;
  height: 14px;
  background: #ffffff;
  border-radius: 2px;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
  transform: translateX(-50%);
  transition: left 0.3s ease;
}

.potential-labels {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: #64748b;
}

.interactive-section {
  margin-top: 2px;
}
</style>
