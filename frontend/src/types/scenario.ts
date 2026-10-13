export type ScenarioModule = 'energy' | 'ecology' | 'hydrology'

export interface InterventionItem {
  id: string
  buildingId?: number
  buildingName?: string
  module: ScenarioModule
  type: string
  name: string
  quantity: number
  unit: string
  costIdr: number
  co2OffsetKgYr: number
  energyMWhYr?: number
  storageM3?: number
  coolingDeltaC?: number
  coordinates?: [number, number]
  polygon?: [number, number][]
  timestamp: number
  metadata?: Record<string, any>
}

export interface SolarPanelModel {
  id: string
  brand: string
  power_wp: number
  area_m2: number
  efficiency: number
  cost_per_panel_idr: number
  cost_per_kwp_idr: number
  lifespan_years: number
  description: string
}

export interface TorenOption {
  id: string
  name: string
  capacity_liters: number
  capacity_m3: number
  cost_idr: number
  diameter_m: number
  height_m: number
}

export interface VerticalGreeningSystem {
  id: string
  name: string
  type: string
  description: string
  plant_species: string
  cost_idr_per_m2: number
  co2_mitigation_kg_m2_yr: number
  wall_cooling_celsius: number
  frame_depth_m: number
}

export interface DryWellOption {
  id: string
  name: string
  type: string
  cost_idr: number
  storage_m3: number
  diameter_m: number
  depth_m: number
}

export interface RetentionPondOption {
  id: string
  name: string
  type: string
  cost_idr_per_m3: number
  standard_depth_m: number
}
