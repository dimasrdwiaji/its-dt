<script setup lang="ts">
import { useMapStore } from '@/stores/mapStore'
import { useScenarioStore } from '@/stores/scenarioStore'
import MapViewer from '@/components/MapViewer.vue'
import ThematicCatalogPanel from '@/components/ThematicCatalogPanel.vue'
import BuildingBaselineCard from '@/components/BuildingBaselineCard.vue'
import UnifiedPlanInspector from '@/components/UnifiedPlanInspector.vue'
import LegendPanel from '@/components/LegendPanel.vue'
import ProgressSpinner from 'primevue/progressspinner'

defineOptions({
  name: 'DigitalTwinView'
})

const mapStore = useMapStore()
const scenarioStore = useScenarioStore()

function toggleMeasure() {
  if (mapStore.activeTool === 'measure') {
    mapStore.setActiveTool('info')
  } else {
    mapStore.setActiveTool('measure')
  }
}
</script>

<template>
  <div class="twin-view-container">
    <!-- 3D Mapbox GL + deck.gl Canvas -->
    <MapViewer />

    <!-- Mode Switcher Floating Island (Top-Center of Map Canvas) -->
    <div class="map-mode-island">
      <div class="mode-pill">
        <button
          type="button"
          class="mode-btn"
          :class="{ active: mapStore.campusMode === 'explore' }"
          @click="mapStore.setCampusMode('explore')"
        >
          <i class="pi pi-eye"></i>
          <span>1. Explore Baseline</span>
        </button>
        <button
          type="button"
          class="mode-btn"
          :class="{ active: mapStore.campusMode === 'plan' }"
          @click="mapStore.setCampusMode('plan')"
        >
          <i class="pi pi-pencil"></i>
          <span>2. Plan Interventions</span>
        </button>
      </div>
    </div>

    <!-- Sub-Tool Dock (Floating pill near top-left) -->
    <div class="map-tool-dock">
      <button
        v-if="mapStore.campusMode === 'explore'"
        type="button"
        class="dock-btn"
        :class="{ active: mapStore.showContent }"
        @click="mapStore.toggleContent()"
        title="Toggle Layers"
      >
        <i class="pi pi-layers"></i>
        <span>Layers</span>
      </button>

      <button
        type="button"
        class="dock-btn"
        :class="{ active: mapStore.showLegend }"
        @click="mapStore.toggleLegend()"
        title="Toggle Legend"
      >
        <i class="pi pi-sliders-h"></i>
        <span>Legend</span>
      </button>

      <div class="dock-divider"></div>

      <button
        type="button"
        class="dock-btn"
        :class="{ active: mapStore.activeTool === 'measure' }"
        @click="toggleMeasure"
        title="Measure Distance"
      >
        <i class="pi pi-arrows-h"></i>
        <span>Measure</span>
      </button>

      <button
        v-if="mapStore.activeTool === 'measure' && mapStore.measurePoints.length > 0"
        type="button"
        class="dock-btn btn-danger"
        @click="mapStore.clearMeasure()"
      >
        <i class="pi pi-trash"></i>
        <span>Clear</span>
      </button>
    </div>

    <!-- EXPLORE MODE: Left Layer Catalog & Right Baseline Card -->
    <template v-if="mapStore.campusMode === 'explore'">
      <ThematicCatalogPanel v-if="mapStore.showContent" />
      <BuildingBaselineCard v-if="mapStore.selectedBuilding" />
    </template>

    <!-- PLAN MODE: Right Unified Plan Inspector -->
    <template v-if="mapStore.campusMode === 'plan'">
      <UnifiedPlanInspector />
    </template>

    <!-- Dynamic Map Legend Panel -->
    <LegendPanel v-if="mapStore.showLegend" />

    <!-- Loading Overlay -->
    <div v-if="mapStore.loading" class="loading-overlay">
      <ProgressSpinner style="width: 44px; height: 44px" />
      <span class="loading-text">Loading Campus 3D Data...</span>
    </div>
  </div>
</template>

<style scoped>
.twin-view-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #eae5dc;
}

/* Floating Mode Switcher Island */
.map-mode-island {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 850;
  box-shadow: 0 4px 14px rgba(41, 37, 36, 0.08);
  border-radius: 8px;
}

.mode-pill {
  display: flex;
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 14px;
  font-size: 11.5px;
  font-weight: 600;
  font-family: inherit;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-btn:hover {
  color: var(--text-main);
}

.mode-btn.active {
  background: var(--text-main);
  color: #ffffff;
}

/* Floating Sub-Tool Dock */
.map-tool-dock {
  position: absolute;
  top: 14px;
  left: 14px;
  height: 38px;
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 850;
  box-shadow: 0 4px 14px rgba(41, 37, 36, 0.06);
}

.dock-btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 11.5px;
  font-weight: 600;
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dock-btn:hover {
  background: var(--bg-subtle);
  color: var(--text-main);
}

.dock-btn.active {
  background: var(--bg-subtle);
  color: var(--text-main);
  border-color: var(--border-subtle);
}

.btn-danger {
  color: #dc2626;
}

.btn-danger:hover {
  background: #fef2f2;
}

.dock-divider {
  width: 1px;
  height: 18px;
  background: var(--border-subtle);
  margin: 0 2px;
}

/* Loading Overlay */
.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(250, 249, 246, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 2000;
}

.loading-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}
</style>
