import axios from 'axios'
import type { BuildingFeatureCollection } from '@/types'
import rulesData from '@/intervention_rules.json'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
const IS_STATIC_MODE = import.meta.env.VITE_STATIC_MODE === 'true'

export async function fetchBuildings(): Promise<BuildingFeatureCollection> {
  if (!IS_STATIC_MODE) {
    try {
      const response = await axios.get<BuildingFeatureCollection>(`${API_BASE}/buildings`, { timeout: 3500 })
      return response.data
    } catch (e) {
      console.warn('Backend API unavailable. Falling back to static /data/buildings.geojson')
    }
  }
  const response = await axios.get<BuildingFeatureCollection>('/data/buildings.geojson')
  return response.data
}

export async function fetchCatalog(): Promise<any> {
  if (!IS_STATIC_MODE) {
    try {
      const response = await axios.get(`${API_BASE}/catalog`, { timeout: 3500 })
      return response.data
    } catch (e) {
      console.warn('Backend API unavailable. Falling back to static /data/catalog.json')
    }
  }
  const response = await axios.get('/data/catalog.json')
  return response.data
}

export async function fetchRasters(): Promise<any[]> {
  if (!IS_STATIC_MODE) {
    try {
      const response = await axios.get(`${API_BASE}/rasters`, { timeout: 3500 })
      return response.data
    } catch (e) {
      console.warn('Backend API unavailable. Falling back to static /data/rasters.json')
    }
  }
  const response = await axios.get<any[]>('/data/rasters.json')
  return response.data
}

export async function fetchRoads(): Promise<any> {
  const response = await axios.get('/data/roads.geojson')
  return response.data
}

export async function fetchInterventionCatalog(): Promise<any> {
  const response = await axios.get('/data/intervention_catalog.json')
  return response.data
}

export interface EcologyPredictionResult {
  baseline_lst_c: number
  new_lst_c: number
  delta_c: number
  intervention: string
  canopy_radius_m: number
  cost_idr: number
  co2_mitigation_kg_yr: number
}

import catalogData from '@/data/intervention_catalog.json'

export async function predictEcology(lat: number, lon: number, interventionId: string): Promise<EcologyPredictionResult> {
  if (!IS_STATIC_MODE) {
    try {
      const response = await axios.post<EcologyPredictionResult>(
        `${API_BASE}/ecology/predict`,
        { lat, lon, intervention_id: interventionId },
        { timeout: 3500 }
      )
      return response.data
    } catch (e) {
      console.warn('Backend ecology prediction unavailable. Falling back to client-side empirical model.')
    }
  }

  // Client-side fallback using calibrated plant parameters from verified intervention catalog
  const allPlants = (catalogData as any).plants || []
  const plant = allPlants.find((p: any) => p.id === interventionId) || allPlants[0]
  const baselineLst = 36.8 // Surabaya campus October daytime mean LST (°C)
  const coolingDelta = plant.cooling_delta_c || -1.6

  return {
    baseline_lst_c: baselineLst,
    new_lst_c: Number((baselineLst + coolingDelta).toFixed(2)),
    delta_c: coolingDelta,
    intervention: plant.name,
    canopy_radius_m: plant.canopy_radius_m || 4.5,
    cost_idr: plant.planted_cost_idr || plant.nursery_cost_idr || 350000,
    co2_mitigation_kg_yr: plant.co2_sequestration_kg_yr || 12.5
  }
}
