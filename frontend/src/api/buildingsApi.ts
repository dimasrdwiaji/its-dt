import axios from 'axios'
import type { BuildingFeatureCollection } from '@/types'

const API_BASE = 'http://localhost:8000/api'

export async function fetchBuildings(): Promise<BuildingFeatureCollection> {
  const response = await axios.get<BuildingFeatureCollection>(`${API_BASE}/buildings`)
  return response.data
}

export async function fetchCatalog(): Promise<any> {
  const response = await axios.get(`${API_BASE}/catalog`)
  return response.data
}

export async function fetchRasters(): Promise<any[]> {
  const response = await axios.get(`${API_BASE}/rasters`)
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

export async function predictEcology(lat: number, lon: number, interventionId: string): Promise<EcologyPredictionResult> {
  const response = await axios.post<EcologyPredictionResult>(`${API_BASE}/ecology/predict`, {
    lat,
    lon,
    intervention_id: interventionId
  })
  return response.data
}
