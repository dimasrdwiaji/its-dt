<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted } from 'vue'
import mapboxgl from 'mapbox-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { useMapStore } from '@/stores/mapStore'
import { useScenarioStore } from '@/stores/scenarioStore'
import { useDeckLayers } from '@/composables/useDeckLayers'
import { MAP_STYLES } from '@/constants/mapStyles'
import { predictEcology } from '@/api/buildingsApi'
import tokenData from '@/token.json'
import * as turf from '@turf/turf'
import Button from 'primevue/button'

const mapContainer = ref<HTMLDivElement | null>(null)
const mapStore = useMapStore()
const scenarioStore = useScenarioStore()
const { getLayers } = useDeckLayers(mapStore)
const plantingLoading = ref(false)

let map: mapboxgl.Map | null = null
let deckOverlay: MapboxOverlay | null = null

function updateDeckOverlay() {
  if (deckOverlay) {
    const layers = getLayers()
    deckOverlay.setProps({ layers })
  }
}

function finalizePond() {
  if (mapStore.pondPoints.length < 3) return
  const points = [...mapStore.pondPoints]
  const closedCoords = [...points, points[0]]
  const poly = turf.polygon([closedCoords])
  const area = turf.area(poly)
  mapStore.setPendingPond({
    coordinates: closedCoords,
    areaM2: area
  })
  updateDeckOverlay()
}

onMounted(async () => {
  if (!mapContainer.value) return

  // Ensure token is loaded
  const token = tokenData.mapbox || (tokenData as any).token
  if (!token) {
    console.error('Mapbox access token is missing from token.json!')
    return
  }
  mapboxgl.accessToken = token

  // Fetch building data in parallel with map init
  mapStore.initData().then(() => {
    updateDeckOverlay()
  })

  // Initialize Mapbox GL in 2.5D perspective
  try {
    map = new mapboxgl.Map({
      container: mapContainer.value,
      style: MAP_STYLES[mapStore.baseMapStyle],
      center: [112.7946, -7.2814], // ITS Surabaya campus
      zoom: 15.6,
      pitch: 52,
      bearing: -18,
      antialias: true
    })
  } catch (err) {
    console.error('Failed to initialize Mapbox GL:', err)
    return
  }

  // Add navigation controls
  map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-left')

  // Initialize deck.gl MapboxOverlay
  deckOverlay = new MapboxOverlay({
    layers: getLayers(),
    interleaved: false
  })

  map.addControl(deckOverlay as any)

  map.on('error', (e) => {
    console.error('Mapbox runtime error:', e)
  })

  map.on('load', () => {
    if (map) {
      map.resize()
    }
    updateDeckOverlay()
  })

  // Handle map double clicks to finalize retention pond
  map.on('dblclick', (e) => {
    if (mapStore.activeTool === 'retention_pond' && mapStore.pondPoints.length >= 3) {
      e.preventDefault()
      finalizePond()
    }
  })

  // Handle map clicks for tools
  map.on('click', async (e) => {
    if (mapStore.activeTool === 'measure') {
      mapStore.addMeasurePoint([e.lngLat.lng, e.lngLat.lat])
    } else if (mapStore.activeTool === 'plant_tree') {
      plantingLoading.value = true
      try {
        const result = await predictEcology(e.lngLat.lat, e.lngLat.lng, mapStore.selectedTreeSpecies)
        
        scenarioStore.addIntervention({
          id: `tree_${Date.now()}`,
          module: 'ecology',
          type: 'ground_tree',
          name: result.intervention,
          quantity: 1,
          unit: 'tree',
          costIdr: result.cost_idr,
          co2OffsetKgYr: result.co2_mitigation_kg_yr,
          coolingDeltaC: result.delta_c,
          coordinates: [e.lngLat.lng, e.lngLat.lat],
          timestamp: Date.now(),
          metadata: {
            speciesId: mapStore.selectedTreeSpecies,
            baselineLst: result.baseline_lst_c,
            newLst: result.new_lst_c,
            canopyRadiusM: result.canopy_radius_m
          }
        })

        mapStore.setLatestPrediction({
          ...result,
          lat: e.lngLat.lat,
          lon: e.lngLat.lng
        })

        updateDeckOverlay()
      } catch (err: any) {
        console.error('Error predicting tree LST impact:', err)
        alert(err.response?.data?.detail || 'Tree prediction failed. Ensure coordinates are within the campus study bounds.')
      } finally {
        plantingLoading.value = false
      }
    } else if (mapStore.activeTool === 'dry_well') {
      const wellItem = {
        id: `drywell_${Date.now()}`,
        module: 'hydrology' as const,
        type: 'ground_dry_well',
        name: 'Sumur Resapan Moduler',
        quantity: 1,
        unit: 'well',
        costIdr: 1800000,
        co2OffsetKgYr: 0,
        storageM3: 2.0,
        coordinates: [e.lngLat.lng, e.lngLat.lat] as [number, number],
        timestamp: Date.now(),
        metadata: {
          diameterM: 1.0,
          depthM: 2.5,
          storageM3: 2.0
        }
      }
      scenarioStore.addIntervention(wellItem)
      mapStore.setSelectedDryWell(wellItem)
      updateDeckOverlay()
    } else if (mapStore.activeTool === 'retention_pond') {
      mapStore.addPondPoint([e.lngLat.lng, e.lngLat.lat])
      updateDeckOverlay()
    }
  })

  // Watch activeTool to set cursor styling on canvas
  watch(
    () => mapStore.activeTool,
    (tool) => {
      if (map) {
        if (tool === 'plant_tree' || tool === 'dry_well' || tool === 'retention_pond') {
          map.getCanvas().style.cursor = 'crosshair'
        } else if (tool === 'measure') {
          map.getCanvas().style.cursor = 'pointer'
        } else {
          map.getCanvas().style.cursor = ''
        }
      }
    }
  )

  const onWindowResize = () => {
    if (map) map.resize()
  }
  window.addEventListener('resize', onWindowResize)

  // Watchers to trigger layer re-render
  watch(
    () => [
      mapStore.colorMode,
      mapStore.selectedBuilding,
      mapStore.layersVisibility.buildings,
      mapStore.buildingData,
      mapStore.measurePoints.length,
      mapStore.pondPoints.length,
      mapStore.tree3DModel,
      scenarioStore.interventions.length
    ],
    () => {
      updateDeckOverlay()
    },
    { deep: true }
  )

  // Watch basemap style change
  watch(
    () => mapStore.baseMapStyle,
    (newStyle) => {
      if (map) {
        map.setStyle(MAP_STYLES[newStyle])
        map.once('style.load', () => {
          updateDeckOverlay()
        })
      }
    }
  )
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="mapbox-container"></div>

    <!-- Active Measurement Floating Pill -->
    <div
      v-if="mapStore.activeTool === 'measure'"
      class="measure-pill"
    >
      <i class="pi pi-arrows-h mr-2"></i>
      <span v-if="mapStore.measureDistanceMeters !== null">
        Total Distance: <strong>{{ mapStore.measureDistanceMeters }} m</strong>
      </span>
      <span v-else>
        Click points on the map to measure distance
      </span>
    </div>

    <!-- Active Tree Planting Floating Pill -->
    <div
      v-if="mapStore.activeTool === 'plant_tree'"
      class="plant-pill"
    >
      <i class="pi pi-tree mr-2 text-green-400"></i>
      <span v-if="plantingLoading">
        Running Random Forest LST inference...
      </span>
      <span v-else>
        Click anywhere on campus ground to plant & predict LST cooling
      </span>
    </div>

    <!-- Active Dry Well Floating Pill -->
    <div
      v-if="mapStore.activeTool === 'dry_well'"
      class="well-pill"
    >
      <i class="pi pi-circle mr-2 text-sky-400"></i>
      <span>
        Click anywhere on campus ground to place a Modular Dry Well (+2.0 m³ storage)
      </span>
    </div>

    <!-- Active Retention Pond Floating Pill -->
    <div
      v-if="mapStore.activeTool === 'retention_pond'"
      class="pond-pill"
    >
      <i class="pi pi-clone mr-2 text-cyan-400"></i>
      <span v-if="mapStore.pondPoints.length < 3">
        Click on terrain to lay pond boundary vertices ({{ mapStore.pondPoints.length }}/3 min)
      </span>
      <span v-else>
        Boundary: <strong>{{ mapStore.pondPoints.length }} vertices</strong>
      </span>

      <div v-if="mapStore.pondPoints.length >= 3" class="ml-3 flex gap-2">
        <Button
          label="Complete Pond"
          icon="pi pi-check"
          severity="info"
          size="small"
          class="p-button-xs py-1"
          @click="finalizePond"
        />
        <Button
          label="Clear"
          icon="pi pi-times"
          severity="secondary"
          text
          size="small"
          class="p-button-xs py-1"
          @click="mapStore.clearPondPoints(); updateDeckOverlay()"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.mapbox-container {
  width: 100%;
  height: 100%;
}

.measure-pill,
.plant-pill,
.well-pill,
.pond-pill {
  position: absolute;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(10px);
  font-size: 12px;
  padding: 6px 16px;
  border-radius: 20px;
  z-index: 1000;
  display: flex;
  align-items: center;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.measure-pill {
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #38bdf8;
}

.plant-pill {
  border: 1px solid rgba(52, 211, 153, 0.4);
  color: #6ee7b7;
}

.well-pill {
  border: 1px solid rgba(14, 165, 233, 0.4);
  color: #7dd3fc;
}

.pond-pill {
  border: 1px solid rgba(6, 182, 212, 0.45);
  color: #67e8f9;
}
</style>
