export interface BuildingProperties {
  id: number
  building?: string | null
  name?: string | null
  'building:levels'?: string | null
  height_osm?: number | null
  height_google?: number | null
  height_gba?: number | null
  area: number
  roof_runoff_vol_m3: number
  roof_runoff_coef: number
  adjacent_flood_risk_m3: number
  adjacent_max_pond_depth_m: number
  adjacent_mean_pond_depth_m: number
  flood_risk_level: 'Critical' | 'High' | 'Medium' | 'Low' | string
  l_shade_mean: number
  l_shade_min: number
  l_shade_max: number
  pot_energy_min: number
  pot_energy_mean: number
  pot_energy_median: number
  pot_energy_max: number
  [key: string]: any
}

export interface BuildingFeature {
  type: 'Feature'
  properties: BuildingProperties
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: any
  }
}

export interface BuildingFeatureCollection {
  type: 'FeatureCollection'
  features: BuildingFeature[]
}
