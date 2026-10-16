import catalogData from '@/data/intervention_catalog.json'

export interface CatalogSolarPV {
  id: string
  name: string
  brand: string
  model: string
  module_type: string
  power_wp: number
  efficiency: number
  dimensions_mm: number[]
  area_m2: number
  temp_coefficient_pmax: number
  warranty_product_years: number
  warranty_performance_years: number
  degradation_year1_pct: number
  degradation_annual_pct: number
  cost_panel_only_idr: number
  cost_turnkey_per_kwp_idr: number
  annual_opex_per_kwp_idr: number
  description: string
  source: {
    type: string
    title: string
    url: string
    notes?: string
  }
}

export interface CatalogTorenTank {
  id: string
  name: string
  brand: string
  model: string
  material: string
  capacity_liters: number
  capacity_m3: number
  diameter_m: number
  height_m: number
  cost_unit_only_idr: number
  cost_installed_idr: number
  annual_maintenance_idr: number
  description: string
  source: {
    type: string
    title: string
    url: string
    notes?: string
  }
}

export interface CatalogPlant {
  id: string
  name: string
  category: 'tree' | 'shrub' | 'groundcover' | 'vertical_greening'
  subcategory: string
  botanical_name: string
  description: string
  canopy_radius_m: number
  height_m: number
  co2_sequestration_kg_yr: number
  cooling_delta_c: number
  nursery_cost_idr: number
  planted_cost_idr: number
  annual_maintenance_idr: number
  ideal_road_types: string[]
  source: {
    type: string
    title: string
    url: string
    notes?: string
  }
}

export interface CatalogDryWell {
  id: string
  name: string
  standard: string
  components: string
  storage_m3: number
  catchment_radius_m: number
  diameter_m: number
  depth_m: number
  cost_installed_idr: number
  annual_maintenance_idr: number
  description: string
  source: {
    type: string
    title: string
    url: string
    notes?: string
  }
}

export interface CatalogRetentionPond {
  id: string
  name: string
  standard: string
  components: string
  standard_depth_m: number
  catchment_radius_m: number
  cost_per_m3_storage_idr: number
  annual_maintenance_per_m3_idr: number
  description: string
  source: {
    type: string
    title: string
    url: string
    notes?: string
  }
}

export interface EconomicRegulatoryParams {
  pln_tariff_idr_per_kwh: number
  pln_tariff_name: string
  regulation: string
  self_consumption_ratio: number
  export_credit_factor: number
  grid_emission_factor_kg_per_kwh: number
  carbon_price_idr_per_ton: number
  carbon_market_name: string
  discount_rate_pct: number
  inflation_rate_pct: number
  inverter_replacement_year: number
  inverter_cost_ratio_pct: number
}

export const catalog = {
  solar_pv: catalogData.solar_pv as CatalogSolarPV[],
  toren_tanks: catalogData.toren_tanks as CatalogTorenTank[],
  plants: catalogData.plants as CatalogPlant[],
  dry_wells: catalogData.dry_wells as CatalogDryWell[],
  retention_ponds: catalogData.retention_ponds as CatalogRetentionPond[],
  economic_regulatory_params: catalogData.economic_regulatory_params as EconomicRegulatoryParams
}

export function getSolarSpec(id?: string): CatalogSolarPV {
  if (id) {
    const found = catalog.solar_pv.find((s) => s.id === id)
    if (found) return found
  }
  return catalog.solar_pv[0]
}

export function getTorenSpec(id?: string): CatalogTorenTank {
  if (id) {
    const found = catalog.toren_tanks.find((t) => t.id === id)
    if (found) return found
  }
  // Default to 5000L if available, or first
  return catalog.toren_tanks[3] || catalog.toren_tanks[0]
}

export function getPlantSpec(id?: string): CatalogPlant {
  if (id) {
    const found = catalog.plants.find((p) => p.id === id)
    if (found) return found
  }
  return catalog.plants[0]
}

export function getLivingWallSpec(): CatalogPlant {
  const found = catalog.plants.find((p) => p.id === 'vertical_frame_lky' || p.category === 'vertical_greening')
  if (found) return found
  return {
    id: 'vertical_frame_lky',
    name: 'Lee Kuan Yew Facade Trellis Frame (Vernonia elliptica)',
    category: 'vertical_greening',
    subcategory: 'facade_green_wall',
    botanical_name: 'Vernonia elliptica',
    description: 'Modular planter box with stainless wire trellis',
    canopy_radius_m: 1.0,
    height_m: 3.0,
    co2_sequestration_kg_yr: 8.5,
    cooling_delta_c: -2.4,
    nursery_cost_idr: 450000,
    planted_cost_idr: 680000,
    annual_maintenance_idr: 45000,
    ideal_road_types: [],
    source: {
      type: 'Literature',
      title: 'Perini et al. (2017)',
      url: 'https://doi.org/10.1016/j.enbuild.2017.06.015'
    }
  }
}

export function getDryWellSpec(): CatalogDryWell {
  return catalog.dry_wells[0]
}

export function getRetentionPondSpec(): CatalogRetentionPond {
  return catalog.retention_ponds[0]
}
