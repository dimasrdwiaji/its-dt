<script setup lang="ts">
import { useMapStore } from '@/stores/mapStore'
import MapViewer from '@/components/MapViewer.vue'
import TopToolbar from '@/components/TopToolbar.vue'
import ContentPanel from '@/components/ContentPanel.vue'
import BuildingInfoCard from '@/components/BuildingInfoCard.vue'
import LegendPanel from '@/components/LegendPanel.vue'
import ScenarioDashboard from '@/components/scenarios/ScenarioDashboard.vue'
import PredictionCard from '@/components/scenarios/PredictionCard.vue'
import PondConfigCard from '@/components/scenarios/PondConfigCard.vue'
import DryWellDetailCard from '@/components/scenarios/DryWellDetailCard.vue'
import PondDetailCard from '@/components/scenarios/PondDetailCard.vue'
import ProgressSpinner from 'primevue/progressspinner'

const mapStore = useMapStore()
</script>

<template>
  <div class="app-container">
    <!-- Map Canvas (2.5D Mapbox GL + deck.gl) -->
    <MapViewer />

    <!-- Top Persistent Toolbar -->
    <TopToolbar />

    <!-- Content Dropdown Panel -->
    <ContentPanel v-if="mapStore.showContent" />

    <!-- Building Info Card (Slides in on building click) -->
    <BuildingInfoCard v-if="mapStore.selectedBuilding" />

    <!-- Dynamic Legend Panel -->
    <LegendPanel v-if="mapStore.showLegend" />

    <!-- Tree Planting Prediction Impact Card -->
    <PredictionCard />

    <!-- Hydrology Retention Pond Configuration Card -->
    <PondConfigCard />

    <!-- Hydrology Dry Well Details Card -->
    <DryWellDetailCard />

    <!-- Hydrology Retention Pond Details Card -->
    <PondDetailCard />

    <!-- Scenario Cumulative Dashboard -->
    <ScenarioDashboard />

    <!-- Loading Overlay -->
    <div v-if="mapStore.loading" class="loading-overlay">
      <ProgressSpinner style="width: 48px; height: 48px" />
      <span class="loading-text">Loading Campus 3D Data...</span>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: #0f172a;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(6px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 2000;
}

.loading-text {
  font-size: 13px;
  font-weight: 500;
  color: #94a3b8;
}
</style>
