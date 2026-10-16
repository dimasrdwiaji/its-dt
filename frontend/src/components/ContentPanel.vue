<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/mapStore'
import { MAP_STYLE_OPTIONS } from '@/constants/mapStyles'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Checkbox from 'primevue/checkbox'
import Slider from 'primevue/slider'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import FormulaTooltip from '@/components/common/FormulaTooltip.vue'

const mapStore = useMapStore()

const energyRasters = computed(() => {
  return mapStore.rasterLayers.filter(r => r.module === 'energy')
})

const ecologyRasters = computed(() => {
  return mapStore.rasterLayers.filter(r => r.module === 'ecology')
})

const hydrologyRasters = computed(() => {
  return mapStore.rasterLayers.filter(r => r.module === 'hydrology')
})

function isRasterActive(id: string): boolean {
  return !!mapStore.activeRasters[id]?.visible
}

function getRasterOpacity(id: string): number {
  return mapStore.activeRasters[id]?.opacity ?? 0.8
}

function onOpacityChange(id: string, val: number) {
  mapStore.setRasterOpacity(id, val)
}

function getRasterFormula(r: any): string {
  switch (r.id) {
    case 'solar_irradiance':
      return 'GHI (kWh/m²/yr) = ∫ (Direct_GTI + Diffuse_GTI + Reflected_GTI) dt'
    case 'daylight_duration':
      return 'Daylight (Hours/yr) = ∑ (1 - Shadow_Flag) × Δt'
    case 'lst_temperature':
      return 'LST (°C) = T_sensor ÷ (1 + (λ · T_sensor ÷ ρ) · ln(ε)) - 273.15'
    case 'canopy_height':
      return 'CHM (m) = Z_surface (DSM) - Z_terrain (DTM)'
    case 'flow_accumulation':
      return 'Flow Accumulation = ∑ Upstream Contributing Cells'
    case 'pooling_depth':
      return 'Pooling Depth (m) = Z_fill - Z_dem'
    default:
      return `Value = f(${r.name})`
  }
}

function getRasterVariables(r: any) {
  const resolution = r.id === 'lst_temperature' || r.id === 'canopy_height' ? '10.0 m' : (r.module === 'hydrology' ? '8.27 m' : '2.0 m')
  return [
    { name: 'Spatial Resolution', value: resolution },
    { name: 'Measurement Unit', value: r.unit },
    { name: 'Colormap Stretch', value: `${r.min_label} → ${r.max_label}` }
  ]
}
</script>

<template>
  <div class="content-panel">
    <!-- Panel Header -->
    <div class="panel-header">
      <div class="flex align-items-center gap-2">
        <i class="pi pi-layers text-cyan-400"></i>
        <span class="panel-title">Layers & Thematic Modules</span>
      </div>
      <Button
        icon="pi pi-times"
        text
        rounded
        size="small"
        @click="mapStore.toggleContent()"
      />
    </div>

    <!-- Accordion Body -->
    <div class="accordion-container">
      <Accordion :value="['base', 'energy', 'ecology', 'hydrology']" multiple class="custom-accordion">
        
        <!-- 1. BASE LAYERS & BASEMAP -->
        <AccordionPanel value="base">
          <AccordionHeader>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-map text-slate-400 text-xs"></i>
              <span class="text-xs font-semibold">Base Layers & Basemap</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="flex flex-column gap-3 py-1">
              <!-- 3D Buildings Checkbox -->
              <div class="layer-item">
                <Checkbox
                  v-model="mapStore.layersVisibility.buildings"
                  inputId="layer-buildings"
                  :binary="true"
                />
                <label for="layer-buildings" class="layer-label">
                  <i class="pi pi-building mr-2 text-slate-300"></i>
                  <span>Campus 3D Structures (LoD1)</span>
                </label>
              </div>

              <!-- Geospatial Road Network Checkbox -->
              <div class="layer-item">
                <Checkbox
                  v-model="mapStore.layersVisibility.roads"
                  inputId="layer-roads"
                  :binary="true"
                />
                <label for="layer-roads" class="layer-label">
                  <i class="pi pi-compass mr-2 text-cyan-400"></i>
                  <span>Road & Pathway Network (OSM)</span>
                </label>
              </div>

              <!-- Low-Hanging Fruit Prioritization -->
              <div class="thematic-toggle-box">
                <div class="flex justify-between items-center mb-1">
                  <span class="sub-label">Low-Hanging Fruit Priority</span>
                  <Tag
                    v-if="mapStore.lowHangingFruitFilter !== 'none'"
                    :value="mapStore.lowHangingFruitFilter.toUpperCase()"
                    :severity="mapStore.lowHangingFruitFilter === 'solar' ? 'warn' : (mapStore.lowHangingFruitFilter === 'flood' ? 'info' : 'success')"
                    size="small"
                  />
                </div>
                <div class="grid grid-cols-4 gap-1 text-[10px] mt-1">
                  <Button
                    label="None"
                    size="small"
                    :severity="mapStore.lowHangingFruitFilter === 'none' ? 'primary' : 'secondary'"
                    :outlined="mapStore.lowHangingFruitFilter !== 'none'"
                    class="py-1 px-1 text-[10px]"
                    @click="mapStore.setLowHangingFruitFilter('none')"
                  />
                  <Button
                    label="Solar"
                    icon="pi pi-sun"
                    size="small"
                    :severity="mapStore.lowHangingFruitFilter === 'solar' ? 'warn' : 'secondary'"
                    :outlined="mapStore.lowHangingFruitFilter !== 'solar'"
                    class="py-1 px-1 text-[10px]"
                    @click="mapStore.setLowHangingFruitFilter('solar')"
                  />
                  <Button
                    label="Flood"
                    icon="pi pi-cloud"
                    size="small"
                    :severity="mapStore.lowHangingFruitFilter === 'flood' ? 'info' : 'secondary'"
                    :outlined="mapStore.lowHangingFruitFilter !== 'flood'"
                    class="py-1 px-1 text-[10px]"
                    @click="mapStore.setLowHangingFruitFilter('flood')"
                  />
                  <Button
                    label="Cooling"
                    icon="pi pi-leaf"
                    size="small"
                    :severity="mapStore.lowHangingFruitFilter === 'thermal' ? 'success' : 'secondary'"
                    :outlined="mapStore.lowHangingFruitFilter !== 'thermal'"
                    class="py-1 px-1 text-[10px]"
                    @click="mapStore.setLowHangingFruitFilter('thermal')"
                  />
                </div>
                <span class="text-[10px] text-slate-400 mt-1 block">
                  Highlights high-payback solar roofs, critical flood pooling depressions, or urban thermal hotspots.
                </span>
              </div>

              <!-- Basemap Style Selector (Migrated from TopToolbar) -->
              <div class="basemap-group">
                <span class="sub-label">Basemap Style</span>
                <div class="basemap-grid">
                  <div
                    v-for="opt in MAP_STYLE_OPTIONS"
                    :key="opt.key"
                    class="basemap-tile"
                    :class="{ active: mapStore.baseMapStyle === opt.key }"
                    @click="mapStore.setBaseMapStyle(opt.key)"
                  >
                    <i :class="opt.icon"></i>
                    <span>{{ opt.label }}</span>
                  </div>
                </div>
              </div>

              <!-- Reset to Neutral Default Buildings -->
              <Button
                v-if="mapStore.colorMode !== 'none'"
                label="Reset to Neutral Off-White 3D"
                icon="pi pi-refresh"
                size="small"
                severity="secondary"
                outlined
                class="w-full text-xs py-1"
                @click="mapStore.setColorMode('none')"
              />
            </div>
          </AccordionContent>
        </AccordionPanel>

        <!-- 2. SOLAR ENERGY MODULE -->
        <AccordionPanel value="energy">
          <AccordionHeader>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-sun text-yellow-400 text-xs"></i>
              <span class="text-xs font-semibold">Solar Energy</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="flex flex-column gap-3 py-1">
              <!-- 3D Building Thematic Toggle -->
              <div class="thematic-toggle-box">
                <div class="flex justify-between align-items-center">
                  <span class="text-xs font-medium text-slate-200">3D Building Solar Potential</span>
                  <Button
                    :label="mapStore.colorMode === 'energy' ? 'Active' : 'Enable'"
                    :severity="mapStore.colorMode === 'energy' ? 'warn' : 'secondary'"
                    :outlined="mapStore.colorMode !== 'energy'"
                    size="small"
                    class="py-1 px-2 text-xs"
                    @click="mapStore.setColorMode(mapStore.colorMode === 'energy' ? 'none' : 'energy')"
                  />
                </div>
                <span class="text-xs text-slate-400 mt-1 block">Tints building roofs from Yellow (low) to Red (high annual PV yield).</span>
              </div>

              <!-- Module Rasters -->
              <div class="rasters-group">
                <span class="sub-label">Solar GeoTIFF Overlays</span>
                <div v-for="r in energyRasters" :key="r.id" class="raster-item">
                  <div class="flex justify-between align-items-center">
                    <div class="flex align-items-center gap-2">
                      <Checkbox
                        :modelValue="isRasterActive(r.id)"
                        :inputId="`raster-${r.id}`"
                        :binary="true"
                        @update:modelValue="mapStore.toggleRaster(r.id)"
                      />
                      <label :for="`raster-${r.id}`" class="raster-name">{{ r.name }}</label>
                      <FormulaTooltip
                        :title="r.name"
                        :plainWords="r.derivation"
                        :formula="getRasterFormula(r)"
                        :variables="getRasterVariables(r)"
                        source="SEBE Solar Modeling Simulation on 2m DSM"
                      />
                    </div>
                  </div>

                  <!-- Opacity Slider -->
                  <div v-if="isRasterActive(r.id)" class="opacity-slider-row">
                    <span class="opacity-label">Opacity: {{ Math.round(getRasterOpacity(r.id) * 100) }}%</span>
                    <Slider
                      :modelValue="getRasterOpacity(r.id)"
                      :min="0.1"
                      :max="1.0"
                      :step="0.05"
                      class="flex-1 ml-2"
                      @update:modelValue="onOpacityChange(r.id, $event)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>

        <!-- 3. THERMAL ECOLOGY MODULE -->
        <AccordionPanel value="ecology">
          <AccordionHeader>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-tree text-green-400 text-xs"></i>
              <span class="text-xs font-semibold">Thermal Ecology</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="flex flex-column gap-3 py-1">
              <!-- 3D Building Thematic Toggle -->
              <div class="thematic-toggle-box">
                <div class="flex justify-between align-items-center">
                  <span class="text-xs font-medium text-slate-200">3D Roof Shading / Microclimate</span>
                  <Button
                    :label="mapStore.colorMode === 'ecology' ? 'Active' : 'Enable'"
                    :severity="mapStore.colorMode === 'ecology' ? 'success' : 'secondary'"
                    :outlined="mapStore.colorMode !== 'ecology'"
                    size="small"
                    class="py-1 px-2 text-xs"
                    @click="mapStore.setColorMode(mapStore.colorMode === 'ecology' ? 'none' : 'ecology')"
                  />
                </div>
                <span class="text-xs text-slate-400 mt-1 block">Tints roofs Light to Dark Green based on surrounding canopy & shadow relief.</span>
              </div>

              <!-- Module Rasters -->
              <div class="rasters-group">
                <span class="sub-label">Ecology GeoTIFF Overlays</span>
                <div v-for="r in ecologyRasters" :key="r.id" class="raster-item">
                  <div class="flex justify-between align-items-center">
                    <div class="flex align-items-center gap-2">
                      <Checkbox
                        :modelValue="isRasterActive(r.id)"
                        :inputId="`raster-${r.id}`"
                        :binary="true"
                        @update:modelValue="mapStore.toggleRaster(r.id)"
                      />
                      <label :for="`raster-${r.id}`" class="raster-name">{{ r.name }}</label>
                      <FormulaTooltip
                        :title="r.name"
                        :plainWords="r.derivation"
                        :formula="getRasterFormula(r)"
                        :variables="getRasterVariables(r)"
                        source="Landsat 8 / Sentinel-2 / ETH GEDI (10m Model)"
                      />
                    </div>
                  </div>

                  <!-- Opacity Slider -->
                  <div v-if="isRasterActive(r.id)" class="opacity-slider-row">
                    <span class="opacity-label">Opacity: {{ Math.round(getRasterOpacity(r.id) * 100) }}%</span>
                    <Slider
                      :modelValue="getRasterOpacity(r.id)"
                      :min="0.1"
                      :max="1.0"
                      :step="0.05"
                      class="flex-1 ml-2"
                      @update:modelValue="onOpacityChange(r.id, $event)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>

        <!-- 4. HYDROLOGY MODULE -->
        <AccordionPanel value="hydrology">
          <AccordionHeader>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-cloud text-sky-400 text-xs"></i>
              <span class="text-xs font-semibold">Hydrology</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="flex flex-column gap-3 py-1">
              <!-- 3D Building Thematic Toggle -->
              <div class="thematic-toggle-box">
                <div class="flex justify-between align-items-center">
                  <span class="text-xs font-medium text-slate-200">3D Flood Vulnerability</span>
                  <Button
                    :label="mapStore.colorMode === 'hydrology' ? 'Active' : 'Enable'"
                    :severity="mapStore.colorMode === 'hydrology' ? 'info' : 'secondary'"
                    :outlined="mapStore.colorMode !== 'hydrology'"
                    size="small"
                    class="py-1 px-2 text-xs"
                    @click="mapStore.setColorMode(mapStore.colorMode === 'hydrology' ? 'none' : 'hydrology')"
                  />
                </div>
                <span class="text-xs text-slate-400 mt-1 block">Tints roofs Light to Deep Blue by adjacent depression flood risk.</span>
              </div>

              <!-- Module Rasters -->
              <div class="rasters-group">
                <span class="sub-label">Hydrology GeoTIFF Overlays</span>
                <div v-for="r in hydrologyRasters" :key="r.id" class="raster-item">
                  <div class="flex justify-between align-items-center">
                    <div class="flex align-items-center gap-2">
                      <Checkbox
                        :modelValue="isRasterActive(r.id)"
                        :inputId="`raster-${r.id}`"
                        :binary="true"
                        @update:modelValue="mapStore.toggleRaster(r.id)"
                      />
                      <label :for="`raster-${r.id}`" class="raster-name">{{ r.name }}</label>
                      <FormulaTooltip
                        :title="r.name"
                        :plainWords="r.derivation"
                        :formula="getRasterFormula(r)"
                        :variables="getRasterVariables(r)"
                        source="DEMNAS Pit-Filled Flow Routing Model (8.27m)"
                      />
                    </div>
                  </div>

                  <!-- Opacity Slider -->
                  <div v-if="isRasterActive(r.id)" class="opacity-slider-row">
                    <span class="opacity-label">Opacity: {{ Math.round(getRasterOpacity(r.id) * 100) }}%</span>
                    <Slider
                      :modelValue="getRasterOpacity(r.id)"
                      :min="0.1"
                      :max="1.0"
                      :step="0.05"
                      class="flex-1 ml-2"
                      @update:modelValue="onOpacityChange(r.id, $event)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>

      </Accordion>
    </div>
  </div>
</template>

<style scoped>
.content-panel {
  position: absolute;
  top: 68px;
  left: 12px;
  width: 335px;
  max-height: calc(100vh - 84px);
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 12px;
  padding: 14px;
  z-index: 1000;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: slideInLeft 0.2s ease-out;
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-15px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  padding-bottom: 8px;
}

.panel-title {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
}

.accordion-container {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.05);
}

.layer-label {
  font-size: 11.5px;
  color: #cbd5e1;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.basemap-group,
.rasters-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sub-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.05em;
}

.basemap-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.basemap-tile {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(148, 163, 184, 0.05);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 6px;
  font-size: 11px;
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.15s ease;
}

.basemap-tile:hover {
  background: rgba(148, 163, 184, 0.12);
}

.basemap-tile.active {
  background: rgba(14, 165, 233, 0.15);
  border-color: rgba(14, 165, 233, 0.4);
  color: #38bdf8;
  font-weight: 600;
}

.thematic-toggle-box {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  padding: 8px 10px;
}

.raster-item {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.08);
  border-radius: 6px;
  padding: 7px 9px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.raster-name {
  font-size: 11px;
  color: #e2e8f0;
  cursor: pointer;
}

.opacity-slider-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px;
}

.opacity-label {
  font-size: 9.5px;
  color: #94a3b8;
}
</style>
