<script setup lang="ts">
import { useMapStore } from '@/stores/mapStore'
import { useScenarioStore } from '@/stores/scenarioStore'
import { MAP_STYLE_OPTIONS } from '@/constants/mapStyles'
import Button from 'primevue/button'
import Select from 'primevue/select'
import type { ActiveTool, BaseMapStyle } from '@/types'

const mapStore = useMapStore()
const scenarioStore = useScenarioStore()

function handleToolSelect(tool: ActiveTool) {
  if (mapStore.activeTool === tool) {
    mapStore.setActiveTool(null)
  } else {
    mapStore.setActiveTool(tool)
    if (tool === 'plant_tree' && mapStore.colorMode !== 'ecology') {
      mapStore.setColorMode('ecology')
    } else if ((tool === 'dry_well' || tool === 'retention_pond') && mapStore.colorMode !== 'hydrology') {
      mapStore.setColorMode('hydrology')
    }
  }
}

const treeSpeciesOptions = [
  { label: 'Trembesi (10m)', value: 'tree_trembesi' },
  { label: 'Angsana (6m)', value: 'tree_angsana' }
]

function onStyleChange(newStyle: BaseMapStyle) {
  mapStore.setBaseMapStyle(newStyle)
}
</script>

<template>
  <header class="top-toolbar">
    <!-- Brand / Title -->
    <div class="brand-section">
      <div class="brand-logo">
        <i class="pi pi-building text-primary text-lg"></i>
      </div>
      <div class="brand-text">
        <span class="brand-title">ITS Digital Twin</span>
        <span class="brand-subtitle">Campus LoD1 Analysis</span>
      </div>
    </div>

    <div class="toolbar-divider"></div>

    <!-- Navigation & Panels -->
    <div class="toolbar-actions">
      <Button
        :label="'Content'"
        icon="pi pi-layers"
        :severity="mapStore.showContent ? 'primary' : 'secondary'"
        :outlined="!mapStore.showContent"
        size="small"
        @click="mapStore.toggleContent()"
      />

      <Button
        :label="'Legend'"
        icon="pi pi-sliders-h"
        :severity="mapStore.showLegend ? 'primary' : 'secondary'"
        :outlined="!mapStore.showLegend"
        size="small"
        @click="mapStore.toggleLegend()"
      />

      <Button
        :label="`Scenario (${scenarioStore.totalInterventionsCount})`"
        icon="pi pi-chart-bar"
        :severity="scenarioStore.totalInterventionsCount > 0 ? 'success' : 'secondary'"
        :outlined="!scenarioStore.showDashboard"
        size="small"
        @click="scenarioStore.toggleDashboard()"
      />
    </div>

    <div class="toolbar-divider"></div>

    <!-- Toolbox -->
    <div class="toolbox-group">
      <Button
        icon="pi pi-info-circle"
        label="Query Info"
        size="small"
        :severity="mapStore.activeTool === 'info' ? 'primary' : 'secondary'"
        :outlined="mapStore.activeTool !== 'info'"
        @click="handleToolSelect('info')"
      />

      <Button
        icon="pi pi-arrows-h"
        label="Measure"
        size="small"
        :severity="mapStore.activeTool === 'measure' ? 'primary' : 'secondary'"
        :outlined="mapStore.activeTool !== 'measure'"
        @click="handleToolSelect('measure')"
      />

      <Button
        v-if="mapStore.activeTool === 'measure' && mapStore.measurePoints.length > 0"
        icon="pi pi-trash"
        label="Clear"
        severity="danger"
        text
        size="small"
        @click="mapStore.clearMeasure()"
      />

      <!-- Plant Tree Tool (Ecology) -->
      <Button
        icon="pi pi-tree"
        label="Plant Tree"
        size="small"
        :severity="mapStore.activeTool === 'plant_tree' ? 'success' : 'secondary'"
        :outlined="mapStore.activeTool !== 'plant_tree'"
        @click="handleToolSelect('plant_tree')"
      />

      <Select
        v-if="mapStore.activeTool === 'plant_tree'"
        v-model="mapStore.selectedTreeSpecies"
        :options="treeSpeciesOptions"
        optionLabel="label"
        optionValue="value"
        class="w-10rem text-xs"
        size="small"
      >
        <template #value="slotProps">
          <div v-if="slotProps.value" class="flex align-items-center gap-1">
            <i class="pi pi-tree text-green-400 text-xs"></i>
            <span class="text-xs">{{ treeSpeciesOptions.find(o => o.value === slotProps.value)?.label }}</span>
          </div>
        </template>
      </Select>

      <Button
        v-if="mapStore.activeTool === 'plant_tree'"
        :icon="mapStore.tree3DModel ? 'pi pi-box' : 'pi pi-circle'"
        :label="mapStore.tree3DModel ? '3D Mesh' : 'Canopy'"
        size="small"
        severity="secondary"
        text
        @click="mapStore.toggleTree3DModel()"
      />

      <!-- Dry Well Tool (Hydrology) -->
      <Button
        icon="pi pi-circle"
        label="Dry Well"
        size="small"
        :severity="mapStore.activeTool === 'dry_well' ? 'info' : 'secondary'"
        :outlined="mapStore.activeTool !== 'dry_well'"
        @click="handleToolSelect('dry_well')"
      />

      <!-- Retention Pond Tool (Hydrology) -->
      <Button
        icon="pi pi-clone"
        label="Retention Pond"
        size="small"
        :severity="mapStore.activeTool === 'retention_pond' ? 'info' : 'secondary'"
        :outlined="mapStore.activeTool !== 'retention_pond'"
        @click="handleToolSelect('retention_pond')"
      />
    </div>

    <!-- Spacer -->
    <div class="flex-grow-1"></div>

    <!-- Basemap Selector -->
    <div class="basemap-selector">
      <Select
        v-model="mapStore.baseMapStyle"
        :options="MAP_STYLE_OPTIONS"
        optionLabel="label"
        optionValue="key"
        placeholder="Select Basemap"
        class="w-9rem"
        size="small"
        @change="onStyleChange($event.value)"
      >
        <template #value="slotProps">
          <div v-if="slotProps.value" class="flex align-items-center gap-2">
            <i :class="MAP_STYLE_OPTIONS.find(o => o.key === slotProps.value)?.icon"></i>
            <span>{{ MAP_STYLE_OPTIONS.find(o => o.key === slotProps.value)?.label }}</span>
          </div>
        </template>
        <template #option="slotProps">
          <div class="flex align-items-center gap-2">
            <i :class="slotProps.option.icon"></i>
            <span>{{ slotProps.option.label }}</span>
          </div>
        </template>
      </Select>
    </div>
  </header>
</template>

<style scoped>
.top-toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  height: 48px;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 10px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 12px;
  z-index: 1000;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35);
}

.brand-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-logo {
  width: 30px;
  height: 30px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1.2;
}

.brand-subtitle {
  font-size: 10px;
  color: #94a3b8;
  line-height: 1.2;
}

.toolbar-divider {
  width: 1px;
  height: 22px;
  background: rgba(148, 163, 184, 0.2);
}

.toolbar-actions,
.toolbox-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.basemap-selector {
  display: flex;
  align-items: center;
}
</style>
