import {
  catalog,
  getSolarSpec,
  getTorenSpec,
  getPlantSpec,
  getLivingWallSpec,
  getDryWellSpec,
  getRetentionPondSpec
} from './catalog'
import type {
  SolarCalculationResult,
  TorenCalculationResult,
  GreeningCalculationResult,
  TreeCalculationResult,
  DryWellCalculationResult,
  RetentionPondCalculationResult,
  FinancialLifecycleResult,
  CashFlowYear,
  CanonicalInterventionType
} from './types'
import type { InterventionItem, ScenarioModule } from '@/types/scenario'

/**
 * Deep Module: InterventionEngine
 * Single source of truth for engineering sizing, domain calculations,
 * and 25-year financial lifecycle analysis across ITS Campus.
 */

export function calculateSolar(areaM2: number, modelId?: string): SolarCalculationResult {
  const spec = getSolarSpec(modelId)
  const safeArea = Math.max(0, areaM2)
  const panelsCount = Math.floor(safeArea / spec.area_m2)
  const kwpCapacity = Number(((panelsCount * spec.power_wp) / 1000).toFixed(1))
  const annualKwh = Math.round(kwpCapacity * 1450) // Surabaya specific yield ~1,450 kWh/kWp/yr
  const annualEnergyMWh = Number((annualKwh / 1000).toFixed(1))
  const co2OffsetKgYr = Number((annualKwh * catalog.economic_regulatory_params.grid_emission_factor_kg_per_kwh).toFixed(1))
  const capExIdr = Math.round(kwpCapacity * spec.cost_turnkey_per_kwp_idr)
  const annualOpExIdr = Math.round(kwpCapacity * spec.annual_opex_per_kwp_idr)
  const annualSavingsIdr = Math.round(annualKwh * catalog.economic_regulatory_params.pln_tariff_idr_per_kwh)
  const simplePaybackYears =
    annualSavingsIdr > 0 ? Number((capExIdr / annualSavingsIdr).toFixed(1)) : 0

  return {
    panelsCount,
    kwpCapacity,
    annualKwh,
    annualEnergyMWh,
    co2OffsetKgYr,
    annualSavingsIdr,
    capExIdr,
    annualOpExIdr,
    simplePaybackYears,
    areaOccupiedM2: Number((panelsCount * spec.area_m2).toFixed(1)),
    modelId: spec.id,
    modelName: spec.name
  }
}

export function calculateToren(
  count: number,
  modelId?: string,
  roofAreaM2: number = 200
): TorenCalculationResult {
  const spec = getTorenSpec(modelId)
  const safeCount = Math.max(0, count)
  const totalStorageLiters = safeCount * spec.capacity_liters
  const totalStorageM3 = Number((safeCount * spec.capacity_m3).toFixed(2))
  const radius = spec.diameter_m / 2
  const roofAreaOccupiedM2 = Number((safeCount * Math.PI * radius * radius).toFixed(1))
  const capExIdr = safeCount * spec.cost_installed_idr
  const annualMaintenanceIdr = safeCount * spec.annual_maintenance_idr

  // Baseline roof runoff for 100mm storm (C=0.95 -> 0.095 m3/m2)
  const baselineRunoffM3 = Math.max(0.1, roofAreaM2 * 0.095)
  const runoffMitigatedM3 = Math.min(baselineRunoffM3, totalStorageM3)
  const retentionPct = Math.min(100, Math.round((runoffMitigatedM3 / baselineRunoffM3) * 100))

  return {
    torenCount: safeCount,
    totalStorageLiters,
    totalStorageM3,
    roofAreaOccupiedM2,
    capExIdr,
    annualMaintenanceIdr,
    runoffMitigatedM3: Number(runoffMitigatedM3.toFixed(2)),
    retentionPct,
    modelId: spec.id,
    modelName: spec.name
  }
}

export function calculateGreening(areaM2: number): GreeningCalculationResult {
  const spec = getLivingWallSpec()
  const safeArea = Math.max(0, areaM2)
  const capExIdr = Math.round(safeArea * spec.planted_cost_idr)
  const annualMaintenanceIdr = Math.round(safeArea * spec.annual_maintenance_idr)
  const co2OffsetKgYr = Number((safeArea * spec.co2_sequestration_kg_yr).toFixed(1))
  const co2OffsetTonsYr = Number((co2OffsetKgYr / 1000).toFixed(2))

  return {
    areaM2: safeArea,
    capExIdr,
    annualMaintenanceIdr,
    co2OffsetKgYr,
    co2OffsetTonsYr,
    coolingDeltaC: spec.cooling_delta_c,
    systemId: spec.id,
    systemName: spec.name
  }
}

export function calculateTree(quantity: number, speciesId?: string): TreeCalculationResult {
  const spec = getPlantSpec(speciesId)
  const safeQty = Math.max(0, quantity)
  const radius = spec.canopy_radius_m || 2.5
  const totalCanopyM2 = Number((safeQty * Math.PI * radius * radius).toFixed(1))
  const capExIdr = safeQty * spec.planted_cost_idr
  const annualMaintenanceIdr = safeQty * spec.annual_maintenance_idr
  const co2OffsetKgYr = Number((safeQty * spec.co2_sequestration_kg_yr).toFixed(1))
  const co2OffsetTonsYr = Number((co2OffsetKgYr / 1000).toFixed(2))

  return {
    quantity: safeQty,
    totalCanopyM2,
    capExIdr,
    annualMaintenanceIdr,
    co2OffsetKgYr,
    co2OffsetTonsYr,
    coolingDeltaC: spec.cooling_delta_c,
    speciesId: spec.id,
    speciesName: spec.name,
    category: spec.category === 'shrub' ? 'shrub' : spec.category === 'groundcover' ? 'groundcover' : 'tree'
  }
}

export function calculateDryWell(quantity: number = 1): DryWellCalculationResult {
  const spec = getDryWellSpec()
  const safeQty = Math.max(0, quantity)
  return {
    quantity: safeQty,
    totalStorageM3: Number((safeQty * spec.storage_m3).toFixed(1)),
    catchmentRadiusM: spec.catchment_radius_m,
    capExIdr: safeQty * spec.cost_installed_idr,
    annualMaintenanceIdr: safeQty * spec.annual_maintenance_idr,
    modelId: spec.id,
    modelName: spec.name
  }
}

export function calculateRetentionPond(areaM2: number, depthM: number = 1.5): RetentionPondCalculationResult {
  const spec = getRetentionPondSpec()
  const safeArea = Math.max(1, areaM2)
  const safeDepth = Math.max(0.5, depthM)
  const totalVolumeM3 = Math.round(safeArea * safeDepth)
  const capExIdr = Math.round(totalVolumeM3 * spec.cost_per_m3_storage_idr)
  const annualMaintenanceIdr = Math.round(totalVolumeM3 * spec.annual_maintenance_per_m3_idr)

  return {
    areaM2: safeArea,
    depthM: safeDepth,
    totalVolumeM3,
    catchmentRadiusM: spec.catchment_radius_m,
    capExIdr,
    annualMaintenanceIdr,
    modelId: spec.id,
    modelName: spec.name
  }
}

/**
 * 25-Year Lifecycle Cost Analysis (LCC) under Permen ESDM No. 2 Tahun 2024
 * Evaluates net present value, cashflows, and payback period across all active interventions.
 */
export function calculateFinancialLifecycle(interventions: InterventionItem[]): FinancialLifecycleResult {
  const capexIdr = interventions.reduce((sum, item) => sum + item.costIdr, 0)

  // Energy generation: check both canonical 'rooftop_pv' and legacy 'solar_rooftop'
  const year1SolarCleanEnergyKWh = interventions
    .filter((i) => i.type === 'rooftop_pv' || i.type === 'solar_rooftop')
    .reduce((sum, i) => sum + (Number(i.energyMWhYr || (i as any).cleanEnergyMWh) || 0) * 1000, 0)

  const params = catalog.economic_regulatory_params
  const plnTariff = params.pln_tariff_idr_per_kwh
  const carbonPrice = params.carbon_price_idr_per_ton
  const discountRate = params.discount_rate_pct / 100
  const inflationRate = params.inflation_rate_pct / 100
  const degradationRate = 0.0055 // 0.55% annual PV degradation
  const annualOpexRatio = 0.012 // 1.2% initial CapEx annual O&M

  let cumulativeCashFlow = -capexIdr
  let cumulativeNpv = -capexIdr
  const yearsData: CashFlowYear[] = []

  for (let yr = 1; yr <= 25; yr++) {
    const generationKWh = year1SolarCleanEnergyKWh * Math.pow(1 - degradationRate, yr - 1)
    const billSavings = generationKWh * plnTariff
    const co2Tons = (generationKWh * params.grid_emission_factor_kg_per_kwh) / 1000
    const carbonRevenue = co2Tons * carbonPrice

    // Annual OpEx with inflation + inverter replacement at Year 12 (15% of CapEx)
    let opex = capexIdr * annualOpexRatio * Math.pow(1 + inflationRate, yr - 1)
    if (yr === params.inverter_replacement_year && year1SolarCleanEnergyKWh > 0) {
      opex += capexIdr * (params.inverter_cost_ratio_pct / 100)
    }

    const netAnnualCashFlow = billSavings + carbonRevenue - opex
    cumulativeCashFlow += netAnnualCashFlow

    const discountedCashFlow = netAnnualCashFlow / Math.pow(1 + discountRate, yr)
    cumulativeNpv += discountedCashFlow

    yearsData.push({
      year: yr,
      generationKWh: Math.round(generationKWh),
      billSavingsIdr: Math.round(billSavings),
      carbonRevenueIdr: Math.round(carbonRevenue),
      opexIdr: Math.round(opex),
      netCashFlowIdr: Math.round(netAnnualCashFlow),
      cumulativeCashFlowIdr: Math.round(cumulativeCashFlow),
      npvIdr: Math.round(cumulativeNpv)
    })
  }

  const breakevenEntry = yearsData.find((d) => d.cumulativeCashFlowIdr >= 0)
  const breakevenYear = breakevenEntry ? breakevenEntry.year : null

  const year1NetCashFlow = yearsData[0]?.netCashFlowIdr || 0
  const simplePaybackYears =
    capexIdr > 0 && year1NetCashFlow > 0 ? Number((capexIdr / year1NetCashFlow).toFixed(1)) : null

  const total25yrSavingsIdr = yearsData.reduce((sum, d) => sum + d.billSavingsIdr + d.carbonRevenueIdr, 0)
  const roi25yrPct = capexIdr > 0 ? Math.round((cumulativeCashFlow / capexIdr) * 100) : 0

  return {
    capexIdr,
    yearsData,
    breakevenYear,
    simplePaybackYears,
    npv25yrIdr: Math.round(cumulativeNpv),
    total25yrSavingsIdr: Math.round(total25yrSavingsIdr),
    roi25yrPct
  }
}

/**
 * Creates a normalized InterventionItem with guaranteed metrics populated.
 */
export function buildInterventionItem(params: {
  id: string
  buildingId?: number
  buildingName?: string
  module: ScenarioModule
  type: CanonicalInterventionType
  name: string
  quantity: number
  unit: string
  costIdr: number
  co2OffsetKgYr?: number
  energyMWhYr?: number
  storageM3?: number
  coolingDeltaC?: number
  coordinates?: [number, number]
  polygon?: [number, number][]
  metadata?: Record<string, any>
}): InterventionItem {
  return {
    id: params.id,
    buildingId: params.buildingId,
    buildingName: params.buildingName,
    module: params.module,
    type: params.type,
    name: params.name,
    quantity: params.quantity,
    unit: params.unit,
    costIdr: params.costIdr,
    co2OffsetKgYr: params.co2OffsetKgYr ?? 0,
    energyMWhYr: params.energyMWhYr,
    storageM3: params.storageM3,
    coolingDeltaC: params.coolingDeltaC,
    coordinates: params.coordinates,
    polygon: params.polygon,
    timestamp: Date.now(),
    metadata: params.metadata || {}
  }
}
