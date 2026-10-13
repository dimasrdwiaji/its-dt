import { defineStore } from 'pinia'
import type { ColorMode, BaseMapStyle, ActiveTool, BuildingProperties, BuildingFeatureCollection } from '@/types'
import { fetchBuildings, fetchCatalog } from '@/api/buildingsApi'
import * as turf from '@turf/turf'

export const useMapStore = defineStore('map', {
  state: () => ({
    colorMode: 'energy' as ColorMode,
    baseMapStyle: 'dark' as BaseMapStyle,
    selectedBuilding: null as BuildingProperties | null,
    activeTool: 'info' as ActiveTool,
    showContent: false,
    showLegend: true,
    measurePoints: [] as [number, number][],
    measureDistanceMeters: null as number | null,
    layersVisibility: {
      buildings: true
    },
    buildingData: null as BuildingFeatureCollection | null,
    catalog: null as any,
    selectedTreeSpecies: 'tree_trembesi' as string,
    latestPrediction: null as any,
    pondPoints: [] as [number, number][],
    pendingPond: null as { coordinates: [number, number][], areaM2: number } | null,
    selectedDryWell: null as any,
    selectedPond: null as any,
    tree3DModel: false as boolean,
    loading: false,
    error: null as string | null
  }),

  actions: {
    setColorMode(mode: ColorMode) {
      this.colorMode = mode
    },

    setBaseMapStyle(style: BaseMapStyle) {
      this.baseMapStyle = style
    },

    setSelectedBuilding(props: BuildingProperties | null) {
      this.selectedBuilding = props
    },

    setActiveTool(tool: ActiveTool) {
      this.activeTool = tool
      if (tool !== 'measure') {
        this.clearMeasure()
      }
      if (tool !== 'retention_pond') {
        this.clearPondPoints()
      }
    },

    setSelectedTreeSpecies(speciesId: string) {
      this.selectedTreeSpecies = speciesId
    },

    toggleTree3DModel() {
      this.tree3DModel = !this.tree3DModel
    },

    addPondPoint(coord: [number, number]) {
      this.pondPoints.push(coord)
    },

    removeLastPondPoint() {
      this.pondPoints.pop()
    },

    clearPondPoints() {
      this.pondPoints = []
    },

    setPendingPond(pond: { coordinates: [number, number][], areaM2: number } | null) {
      this.pendingPond = pond
    },

    clearPendingPond() {
      this.pendingPond = null
    },

    setSelectedDryWell(well: any) {
      this.selectedDryWell = well
    },

    setSelectedPond(pond: any) {
      this.selectedPond = pond
    },

    setLatestPrediction(pred: any) {
      this.latestPrediction = pred
    },

    clearLatestPrediction() {
      this.latestPrediction = null
    },

    toggleContent() {
      this.showContent = !this.showContent
    },

    toggleLegend() {
      this.showLegend = !this.showLegend
    },

    addMeasurePoint(coord: [number, number]) {
      this.measurePoints.push(coord)
      if (this.measurePoints.length >= 2) {
        const line = turf.lineString(this.measurePoints)
        const lengthKm = turf.length(line, { units: 'kilometers' })
        this.measureDistanceMeters = Math.round(lengthKm * 1000)
      } else {
        this.measureDistanceMeters = null
      }
    },

    clearMeasure() {
      this.measurePoints = []
      this.measureDistanceMeters = null
    },

    async initData() {
      this.loading = true
      try {
        const [buildings, catalog] = await Promise.all([
          fetchBuildings(),
          fetchCatalog().catch(() => null)
        ])
        this.buildingData = buildings
        this.catalog = catalog
      } catch (err: any) {
        this.error = err.message || 'Failed to load digital twin data'
        console.error(err)
      } finally {
        this.loading = false
      }
    }
  }
})
