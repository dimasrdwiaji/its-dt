<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/mapStore'
import { MAP_STYLE_OPTIONS } from '@/constants/mapStyles'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import FormulaTooltip from '@/components/common/FormulaTooltip.vue'

const mapStore = useMapStore()

const energyRasters = computed(() => {
  return mapStore.rasterLayers.filter(r => r.module === 'energy')
})

const hydrologyRasters = computed(() => {
  return mapStore.rasterLayers.filter(r => r.module === 'hydrology')
})

const ecologyRasters = computed(() => {
  return mapStore.rasterLayers.filter(r => r.module === 'ecology')
})

function isRasterActive(id: string): boolean {
  return !!mapStore.activeRasters[id]?.visible
}

function getRasterOpacity(id: string): number {
  return Math.round((mapStore.activeRasters[id]?.opacity ?? 0.8) * 100)
}

function onOpacityChange(id: string, e: Event) {
  const target = e.target as HTMLInputElement
  const val = Number(target.value) / 100
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
  <aside class="catalog-panel">
    <!-- Panel Header -->
    <div class="panel-header">
      <div class="flex items-center gap-2">
        <i class="pi pi-layers text-main"></i>
        <span class="panel-title">Thematic Layer Catalog</span>
      </div>
      <button class="btn-close" @click="mapStore.toggleContent()" title="Hide Layers">
        <i class="pi pi-times"></i>
      </button>
    </div>

    <!-- Accordion Groups -->
    <div class="accordion-scroll">
      <Accordion :value="['base', 'energy', 'hydrology', 'ecology']" multiple>
        
        <!-- 1. BASE GEOMETRY & BASEMAP -->
        <AccordionPanel value="base">
          <AccordionHeader>
            <div class="header-inner">
              <i class="pi pi-map header-icon"></i>
              <span>1. Base Geometry & Basemap</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="group-body">
              
              <!-- Basemap Style Selector -->
              <div class="form-block">
                <span class="field-label">Basemap Imagery</span>
                <div class="basemap-pills">
                  <button
                    v-for="opt in MAP_STYLE_OPTIONS"
                    :key="opt.key"
                    type="button"
                    class="basemap-btn"
                    :class="{ active: mapStore.baseMapStyle === opt.key }"
                    @click="mapStore.setBaseMapStyle(opt.key)"
                  >
                    <i :class="opt.icon"></i>
                    <span>{{ opt.label }}</span>
                  </button>
                </div>
              </div>

              <!-- 3D Extrusion & Road Switches -->
              <div class="switch-row">
                <div class="switch-info">
                  <span class="switch-title">Campus 3D Extrusions (LoD1)</span>
                  <span class="switch-sub">Height-extruded building massings</span>
                </div>
                <label class="switch-toggle">
                  <input type="checkbox" v-model="mapStore.layersVisibility.buildings">
                  <span class="slider-round"></span>
                </label>
              </div>

              <div class="switch-row">
                <div class="switch-info">
                  <span class="switch-title">Road Network & Curb Bounds</span>
                  <span class="switch-sub">OSM centerline & Bina Marga curbs</span>
                </div>
                <label class="switch-toggle">
                  <input type="checkbox" v-model="mapStore.layersVisibility.roads">
                  <span class="slider-round"></span>
                </label>
              </div>

              <!-- 3D Roof Tint Mode -->
              <div class="form-block">
                <span class="field-label">3D Building Roof Tint Mode</span>
                <div class="tint-grid">
                  <button
                    type="button"
                    class="tint-btn"
                    :class="{ active: mapStore.colorMode === 'none' }"
                    @click="mapStore.setColorMode('none')"
                  >
                    Off-White
                  </button>
                  <button
                    type="button"
                    class="tint-btn text-solar"
                    :class="{ active: mapStore.colorMode === 'energy' }"
                    @click="mapStore.setColorMode('energy')"
                  >
                    Solar Yield
                  </button>
                  <button
                    type="button"
                    class="tint-btn text-hydro"
                    :class="{ active: mapStore.colorMode === 'hydrology' }"
                    @click="mapStore.setColorMode('hydrology')"
                  >
                    Flood Risk
                  </button>
                  <button
                    type="button"
                    class="tint-btn text-eco"
                    :class="{ active: mapStore.colorMode === 'ecology' }"
                    @click="mapStore.setColorMode('ecology')"
                  >
                    Shade / LST
                  </button>
                </div>
              </div>

            </div>
          </AccordionContent>
        </AccordionPanel>

        <!-- 2. ENERGY & SOLAR -->
        <AccordionPanel value="energy">
          <AccordionHeader>
            <div class="header-inner">
              <i class="pi pi-sun header-icon text-solar"></i>
              <span>2. Energy & Solar Potentials</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="group-body">
              <div v-for="r in energyRasters" :key="r.id" class="raster-block">
                <div class="raster-header">
                  <label class="raster-title-label">
                    <input
                      type="checkbox"
                      :checked="isRasterActive(r.id)"
                      @change="mapStore.toggleRaster(r.id)"
                      class="mr-2"
                    >
                    <span>{{ r.name }}</span>
                  </label>
                  <FormulaTooltip
                    :title="r.name"
                    :formula="getRasterFormula(r)"
                    :variables="getRasterVariables(r)"
                    :source="r.derivation"
                  />
                </div>
                <div v-if="isRasterActive(r.id)" class="opacity-row">
                  <span class="opacity-label">Opacity</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    :value="getRasterOpacity(r.id)"
                    @input="onOpacityChange(r.id, $event)"
                    class="opacity-slider"
                  >
                  <span class="opacity-val font-mono">{{ getRasterOpacity(r.id) }}%</span>
                </div>
              </div>

              <!-- High Payback Focus -->
              <div class="filter-focus-row">
                <button
                  type="button"
                  class="btn-focus"
                  :class="{ active: mapStore.lowHangingFruitFilter === 'solar' }"
                  @click="mapStore.setLowHangingFruitFilter(mapStore.lowHangingFruitFilter === 'solar' ? 'none' : 'solar')"
                >
                  <i class="pi pi-star"></i>
                  <span>Highlight High-Yield Solar Roofs</span>
                </button>
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>

        <!-- 3. HYDROLOGY & DRAINAGE -->
        <AccordionPanel value="hydrology">
          <AccordionHeader>
            <div class="header-inner">
              <i class="pi pi-cloud header-icon text-hydro"></i>
              <span>3. Hydrology & Flood Runoff</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="group-body">
              <div v-for="r in hydrologyRasters" :key="r.id" class="raster-block">
                <div class="raster-header">
                  <label class="raster-title-label">
                    <input
                      type="checkbox"
                      :checked="isRasterActive(r.id)"
                      @change="mapStore.toggleRaster(r.id)"
                      class="mr-2"
                    >
                    <span>{{ r.name }}</span>
                  </label>
                  <FormulaTooltip
                    :title="r.name"
                    :formula="getRasterFormula(r)"
                    :variables="getRasterVariables(r)"
                    :source="r.derivation"
                  />
                </div>
                <div v-if="isRasterActive(r.id)" class="opacity-row">
                  <span class="opacity-label">Opacity</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    :value="getRasterOpacity(r.id)"
                    @input="onOpacityChange(r.id, $event)"
                    class="opacity-slider"
                  >
                  <span class="opacity-val font-mono">{{ getRasterOpacity(r.id) }}%</span>
                </div>
              </div>

              <!-- Flood Focus -->
              <div class="filter-focus-row">
                <button
                  type="button"
                  class="btn-focus"
                  :class="{ active: mapStore.lowHangingFruitFilter === 'flood' }"
                  @click="mapStore.setLowHangingFruitFilter(mapStore.lowHangingFruitFilter === 'flood' ? 'none' : 'flood')"
                >
                  <i class="pi pi-star"></i>
                  <span>Highlight Critical Flood Depressions</span>
                </button>
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>

        <!-- 4. ECOLOGY & MICROCLIMATE -->
        <AccordionPanel value="ecology">
          <AccordionHeader>
            <div class="header-inner">
              <i class="pi pi-compass header-icon text-eco"></i>
              <span>4. Ecology & Urban Microclimate</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="group-body">
              <div v-for="r in ecologyRasters" :key="r.id" class="raster-block">
                <div class="raster-header">
                  <label class="raster-title-label">
                    <input
                      type="checkbox"
                      :checked="isRasterActive(r.id)"
                      @change="mapStore.toggleRaster(r.id)"
                      class="mr-2"
                    >
                    <span>{{ r.name }}</span>
                  </label>
                  <FormulaTooltip
                    :title="r.name"
                    :formula="getRasterFormula(r)"
                    :variables="getRasterVariables(r)"
                    :source="r.derivation"
                  />
                </div>
                <div v-if="isRasterActive(r.id)" class="opacity-row">
                  <span class="opacity-label">Opacity</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    :value="getRasterOpacity(r.id)"
                    @input="onOpacityChange(r.id, $event)"
                    class="opacity-slider"
                  >
                  <span class="opacity-val font-mono">{{ getRasterOpacity(r.id) }}%</span>
                </div>
              </div>

              <!-- Thermal Focus -->
              <div class="filter-focus-row">
                <button
                  type="button"
                  class="btn-focus"
                  :class="{ active: mapStore.lowHangingFruitFilter === 'thermal' }"
                  @click="mapStore.setLowHangingFruitFilter(mapStore.lowHangingFruitFilter === 'thermal' ? 'none' : 'thermal')"
                >
                  <i class="pi pi-star"></i>
                  <span>Highlight Urban Heat Hotspots</span>
                </button>
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>

      </Accordion>
    </div>
  </aside>
</template>

<style scoped>
.catalog-panel {
  position: absolute;
  top: 14px;
  left: 14px;
  bottom: 14px;
  width: 320px;
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(41, 37, 36, 0.06);
  z-index: 900;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  height: 48px;
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-main);
  text-transform: uppercase;
  letter-spacing: 0.04em;
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

.accordion-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  font-weight: 600;
}

.header-icon {
  font-size: 13px;
}

.group-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Basemap Pills */
.form-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.basemap-pills {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.basemap-btn {
  height: 28px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-subtle);
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

.basemap-btn:hover {
  background: #ede8e1;
  color: var(--text-main);
}

.basemap-btn.active {
  background: var(--text-main);
  color: #ffffff;
  border-color: var(--text-main);
}

/* Tint Grid */
.tint-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.tint-btn {
  height: 28px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-subtle);
  color: var(--text-body);
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tint-btn:hover {
  background: #ede8e1;
}

.tint-btn.active {
  border-color: var(--text-main);
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(41, 37, 36, 0.08);
  font-weight: 700;
}

/* Switch Row */
.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #f7f5f0;
}

.switch-info {
  display: flex;
  flex-direction: column;
}

.switch-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-main);
}

.switch-sub {
  font-size: 10px;
  color: var(--text-muted);
}

/* Switch Toggle Styling */
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

/* Raster Block */
.raster-block {
  background: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.raster-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.raster-title-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-main);
  display: flex;
  align-items: center;
  cursor: pointer;
}

.opacity-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10.5px;
  color: var(--text-muted);
  padding-top: 4px;
  border-top: 1px solid rgba(214, 206, 191, 0.4);
}

.opacity-slider {
  flex: 1;
  height: 4px;
  accent-color: var(--text-main);
}

.opacity-val {
  width: 32px;
  text-align: right;
}

/* Filter Focus Row */
.filter-focus-row {
  margin-top: 4px;
}

.btn-focus {
  width: 100%;
  height: 30px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: #ffffff;
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

.btn-focus:hover {
  color: var(--text-main);
  border-color: var(--border-strong);
}

.btn-focus.active {
  background: #ffffff;
  color: var(--text-main);
  border-color: var(--text-main);
  box-shadow: 0 1px 4px rgba(41, 37, 36, 0.08);
  font-weight: 700;
}

.text-main { color: var(--text-main); }
.text-solar { color: var(--solar-accent); }
.text-hydro { color: var(--hydro-accent); }
.text-eco { color: var(--eco-accent); }
</style>
