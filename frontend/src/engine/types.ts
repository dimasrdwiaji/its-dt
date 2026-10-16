/**
 * Unified Domain Types for ITS Digital Twin
 * Single source of truth for intervention modules, spatial hydrology, and lifecycle finance.
 */

export type CanonicalInterventionType =
  | 'rooftop_pv'
  | 'rooftop_toren'
  | 'vertical_greening'
  | 'ground_tree'
  | 'ground_dry_well'
  | 'ground_retention_pond'

export type LegacyInterventionType =
  | 'solar_rooftop'
  | 'water_cistern'
  | 'green_facade'
  | 'dry_well'
  | 'retention_pond'

export type InterventionType = CanonicalInterventionType | LegacyInterventionType

export type FloodRiskLevel = 'Low' | 'Medium' | 'High' | 'Critical'

export interface SolarCalculationResult {
  panelsCount: number
  kwpCapacity: number
  annualKwh: number
  annualEnergyMWh: number
  co2OffsetKgYr: number
  annualSavingsIdr: number
  capExIdr: number
  annualOpExIdr: number
  simplePaybackYears: number
  areaOccupiedM2: number
  modelId: string
  modelName: string
}

export interface TorenCalculationResult {
  torenCount: number
  totalStorageLiters: number
  totalStorageM3: number
  roofAreaOccupiedM2: number
  capExIdr: number
  annualMaintenanceIdr: number
  runoffMitigatedM3: number
  retentionPct: number
  modelId: string
  modelName: string
}

export interface GreeningCalculationResult {
  areaM2: number
  capExIdr: number
  annualMaintenanceIdr: number
  co2OffsetKgYr: number
  co2OffsetTonsYr: number
  coolingDeltaC: number
  systemId: string
  systemName: string
}

export interface TreeCalculationResult {
  quantity: number
  totalCanopyM2: number
  capExIdr: number
  annualMaintenanceIdr: number
  co2OffsetKgYr: number
  co2OffsetTonsYr: number
  coolingDeltaC: number
  speciesId: string
  speciesName: string
  category: 'tree' | 'shrub' | 'groundcover'
}

export interface DryWellCalculationResult {
  quantity: number
  totalStorageM3: number
  catchmentRadiusM: number
  capExIdr: number
  annualMaintenanceIdr: number
  modelId: string
  modelName: string
}

export interface RetentionPondCalculationResult {
  areaM2: number
  depthM: number
  totalVolumeM3: number
  catchmentRadiusM: number
  capExIdr: number
  annualMaintenanceIdr: number
  modelId: string
  modelName: string
}

export interface CashFlowYear {
  year: number
  generationKWh: number
  billSavingsIdr: number
  carbonRevenueIdr: number
  opexIdr: number
  netCashFlowIdr: number
  cumulativeCashFlowIdr: number
  npvIdr: number
}

export interface FinancialLifecycleResult {
  capexIdr: number
  yearsData: CashFlowYear[]
  breakevenYear: number | null
  simplePaybackYears: number | null
  npv25yrIdr: number
  total25yrSavingsIdr: number
  roi25yrPct: number
}

export interface BuildingEffectiveHydrology {
  baselineRoofRunoffM3: number
  netRoofRunoffM3: number
  roofRetentionPct: number
  torenStorageM3: number
  groundReliefM3: number
  baselineAdjacentFlowM3: number
  effectiveAdjacentFlowM3: number
  baselineLevel: FloodRiskLevel
  effectiveLevel: FloodRiskLevel
  isDowngraded: boolean
  isMitigated: boolean
  hasRelief: boolean
}
