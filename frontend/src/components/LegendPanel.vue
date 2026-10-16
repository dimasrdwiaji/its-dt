<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/mapStore'

const mapStore = useMapStore()

const buildingLegend = computed(() => {
  switch (mapStore.colorMode) {
    case 'energy':
      return {
        title: '3D Solar Potential (PV Yield)',
        isNeutral: false,
        gradient: 'linear-gradient(to right, #fef08a, #f97316, #dc2626)',
        minLabel: 'Low (50 MWh)',
        maxLabel: 'High (1,200+ MWh)'
      }
    case 'ecology':
      return {
        title: '3D Roof Shading / Microclimate',
        isNeutral: false,
        gradient: 'linear-gradient(to right, #bbf7d0, #16a34a, #14532d)',
        minLabel: 'Low Shade (0%)',
        maxLabel: 'Dense Shade (50%+)'
      }
    case 'hydrology':
      return {
        title: '3D Flood Vulnerability',
        isNeutral: false,
        gradient: 'linear-gradient(to right, #bae6fd, #0284c7, #1e3a5f)',
        minLabel: 'Low Risk',
        maxLabel: 'Critical'
      }
    case 'none':
    default:
      return {
        title: 'Campus 3D Structures',
        isNeutral: true,
        gradient: '',
        minLabel: 'Neutral LoD1',
        maxLabel: 'Extruded Massing'
      }
  }
})

const activeRasterLegends = computed(() => {
  const list: any[] = []
  for (const r of mapStore.rasterLayers) {
    if (mapStore.activeRasters[r.id]?.visible) {
      let gradient = 'linear-gradient(to right, #ffffff, #000000)'
      if (r.colormap === 'YlOrRd') {
        gradient = 'linear-gradient(to right, #ffffb2, #fd8d3c, #bd0026)'
      } else if (r.colormap === 'cividis') {
        gradient = 'linear-gradient(to right, #00204d, #7c7b78, #ffea46)'
      } else if (r.colormap === 'magma') {
        gradient = 'linear-gradient(to right, #000004, #b63679, #fcfdbf)'
      } else if (r.colormap === 'YlGn') {
        gradient = 'linear-gradient(to right, #ffffe5, #78c679, #004529)'
      } else if (r.colormap === 'PuBu') {
        gradient = 'linear-gradient(to right, #ece7f2, #74a9cf, #023858)'
      } else if (r.colormap === 'Blues') {
        gradient = 'linear-gradient(to right, #f7fbff, #6baed6, #08306b)'
      }

      list.push({
        id: r.id,
        title: `${r.name} (${r.unit})`,
        gradient,
        minLabel: r.min_label,
        maxLabel: r.max_label
      })
    }
  }
  return list
})
</script>

<template>
  <div v-if="mapStore.showLegend" class="legend-panel">
    <!-- Panel Header with Close Button -->
    <div class="legend-header-row">
      <div class="flex align-items-center gap-1">
        <i class="pi pi-map text-cyan-400 text-xs"></i>
        <span class="panel-header-title">Map Legend</span>
      </div>
      <button class="legend-close-btn" title="Hide Legend" @click="mapStore.toggleLegend()">
        <i class="pi pi-times"></i>
      </button>
    </div>

    <!-- Building Thematic Legend or Neutral Massing -->
    <div class="legend-block">
      <span class="legend-title">{{ buildingLegend.title }}</span>
      <div v-if="!buildingLegend.isNeutral" class="legend-bar" :style="{ background: buildingLegend.gradient }"></div>
      <div v-else class="neutral-swatch-row">
        <span class="neutral-swatch"></span>
        <span class="neutral-text">Off-White Neutral Massing</span>
      </div>
      <div class="legend-ticks">
        <span>{{ buildingLegend.minLabel }}</span>
        <span>{{ buildingLegend.maxLabel }}</span>
      </div>
    </div>

    <!-- Active Raster Overlays Legends -->
    <div
      v-for="rl in activeRasterLegends"
      :key="rl.id"
      class="legend-block border-top-subtle"
    >
      <span class="legend-title">{{ rl.title }}</span>
      <div class="legend-bar" :style="{ background: rl.gradient }"></div>
      <div class="legend-ticks">
        <span>{{ rl.minLabel }}</span>
        <span>{{ rl.maxLabel }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.legend-panel {
  position: absolute;
  bottom: 20px;
  left: 360px;
  transition: left 0.2s ease-out;
  width: 235px;
  max-width: calc(100vw - 80px);
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 12px 14px;
  z-index: 950;
  box-shadow: 0 4px 14px rgba(41, 37, 36, 0.06);
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.legend-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 6px;
}

.panel-header-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.legend-close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease;
}

.legend-close-btn:hover {
  color: var(--text-main);
}

.legend-block {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.border-top-subtle {
  border-top: 1px solid var(--border-subtle);
  padding-top: 8px;
}

.legend-title {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-main);
  text-transform: uppercase;
}

.legend-bar {
  height: 8px;
  border-radius: 4px;
}

.neutral-swatch-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}

.neutral-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: #f5f2eb;
  border: 1px solid var(--border-strong);
}

.neutral-text {
  font-size: 11px;
  color: var(--text-body);
}

.legend-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-muted);
}
</style>
