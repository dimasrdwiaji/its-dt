<script setup lang="ts">
import { useMapStore } from '@/stores/mapStore'
import Checkbox from 'primevue/checkbox'
import RadioButton from 'primevue/radiobutton'
import Button from 'primevue/button'
import type { ColorMode } from '@/types'

const mapStore = useMapStore()

interface ModeOption {
  key: ColorMode
  label: string
  icon: string
  description: string
}

const colorModes: ModeOption[] = [
  {
    key: 'energy',
    label: 'Solar Energy',
    icon: 'pi pi-sun',
    description: 'Irradiance & Annual PV Yield (Yellow - Red)'
  },
  {
    key: 'ecology',
    label: 'Thermal Ecology',
    icon: 'pi pi-tree',
    description: 'Shading & Microclimate (Light - Dark Green)'
  },
  {
    key: 'hydrology',
    label: 'Hydrology',
    icon: 'pi pi-cloud',
    description: 'Adjacent Flood Risk & Runoff (Light - Dark Blue)'
  },
  {
    key: 'none',
    label: 'Default',
    icon: 'pi pi-circle',
    description: 'Neutral off-white 3D massing'
  }
]
</script>

<template>
  <div class="content-panel">
    <div class="panel-header">
      <div class="flex align-items-center gap-2">
        <i class="pi pi-layers text-primary"></i>
        <span class="panel-title">Data Layers & Modes</span>
      </div>
      <Button
        icon="pi pi-times"
        text
        rounded
        size="small"
        @click="mapStore.toggleContent()"
      />
    </div>

    <!-- 3D Layers -->
    <div class="section-container">
      <span class="section-title">3D LAYERS</span>
      <div class="layer-item">
        <Checkbox
          v-model="mapStore.layersVisibility.buildings"
          inputId="layer-buildings"
          :binary="true"
        />
        <label for="layer-buildings" class="layer-label">
          <i class="pi pi-building mr-2"></i>
          <span>Campus Buildings (LoD1)</span>
        </label>
      </div>
    </div>

    <!-- Thematic Color Modes -->
    <div class="section-container">
      <span class="section-title">THEMATIC VISUALIZATION</span>
      <div class="modes-list">
        <div
          v-for="m in colorModes"
          :key="m.key"
          class="mode-item"
          :class="{ active: mapStore.colorMode === m.key }"
          @click="mapStore.setColorMode(m.key)"
        >
          <RadioButton
            v-model="mapStore.colorMode"
            :inputId="`mode-${m.key}`"
            name="colorMode"
            :value="m.key"
          />
          <div class="mode-info">
            <div class="flex align-items-center gap-2">
              <i :class="m.icon" class="text-sm"></i>
              <label :for="`mode-${m.key}`" class="mode-label">{{ m.label }}</label>
            </div>
            <span class="mode-desc">{{ m.description }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.content-panel {
  position: absolute;
  top: 68px;
  left: 12px;
  width: 320px;
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 10px;
  padding: 16px;
  z-index: 1000;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  padding-bottom: 10px;
}

.panel-title {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
}

.section-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #64748b;
  text-transform: uppercase;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.06);
}

.layer-label {
  font-size: 13px;
  color: #cbd5e1;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.modes-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mode-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: rgba(148, 163, 184, 0.04);
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-item:hover {
  background: rgba(148, 163, 184, 0.1);
}

.mode-item.active {
  background: rgba(99, 102, 241, 0.12);
  border-color: rgba(99, 102, 241, 0.3);
}

.mode-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mode-label {
  font-size: 12px;
  font-weight: 600;
  color: #f1f5f9;
  cursor: pointer;
}

.mode-desc {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.2;
}
</style>
