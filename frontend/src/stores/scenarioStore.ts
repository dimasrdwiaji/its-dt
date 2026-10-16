import { defineStore } from 'pinia'
import type { InterventionItem } from '@/types/scenario'

function computeDistanceM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000 // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function classifyFloodRisk(qM3: number, pondDepthM: number = 0): string {
  if (qM3 >= 50 || pondDepthM >= 0.5) return 'Critical'
  if (qM3 >= 20 || pondDepthM >= 0.25) return 'High'
  if (qM3 >= 5 || pondDepthM >= 0.1) return 'Medium'
  return 'Low'
}

function loadSavedInterventions(): InterventionItem[] {
  try {
    const raw = localStorage.getItem('its_dt_scenario_interventions')
    if (raw) return JSON.parse(raw)
  } catch (e) {
    // ignore
  }
  return []
}

function persistInterventions(items: InterventionItem[]) {
  try {
    localStorage.setItem('its_dt_scenario_interventions', JSON.stringify(items))
  } catch (e) {
    // ignore
  }
}

export const useScenarioStore = defineStore('scenario', {
  state: () => ({
    interventions: loadSavedInterventions() as InterventionItem[],
    showDashboard: false
  }),

  getters: {
    totalInterventionsCount: (state) => state.interventions.length,

    totalCapExIdr: (state) => {
      return state.interventions.reduce((sum, item) => sum + item.costIdr, 0)
    },

    totalCo2OffsetTons: (state) => {
      const kg = state.interventions.reduce((sum, item) => sum + (item.co2OffsetKgYr || 0), 0)
      return Number((kg / 1000).toFixed(2))
    },

    totalCleanEnergyMWh: (state) => {
      const mwh = state.interventions.reduce((sum, item) => sum + (item.energyMWhYr || 0), 0)
      return Number(mwh.toFixed(1))
    },

    totalAnnualBillSavingsIdr: (state) => {
      const mwh = state.interventions.reduce((sum, item) => sum + (item.energyMWhYr || 0), 0)
      return Math.round(mwh * 1000 * 1444)
    },

    totalStorageAddedM3: (state) => {
      const m3 = state.interventions.reduce((sum, item) => sum + (item.storageM3 || 0), 0)
      return Number(m3.toFixed(1))
    },

    simplePaybackYears(state): number | null {
      const capex = this.totalCapExIdr
      const savings = this.totalAnnualBillSavingsIdr
      if (savings <= 0 || capex <= 0) return null
      return Number((capex / savings).toFixed(1))
    },

    getBuildingSolar: (state) => (buildingId: number) => {
      return state.interventions.find((i) => i.buildingId === buildingId && i.type === 'solar_rooftop')
    },

    getBuildingGreening: (state) => (buildingId: number) => {
      return state.interventions.find((i) => i.buildingId === buildingId && i.type === 'vertical_greening')
    },

    getBuildingToren: (state) => (buildingId: number) => {
      return state.interventions.find((i) => i.buildingId === buildingId && i.type === 'rooftop_toren')
    },

    getPlantedTrees: (state) => {
      return state.interventions.filter((i) => i.type === 'ground_tree')
    },

    getDryWells: (state) => {
      return state.interventions.filter((i) => i.type === 'ground_dry_well')
    },

    getRetentionPonds: (state) => {
      return state.interventions.filter((i) => i.type === 'ground_retention_pond')
    },

    /**
     * Hydrology Back-Coupling: Evaluates net storm runoff and attenuated flood risk
     * accounting for rooftop toren tanks and spatial catchment influence of nearby dry wells / ponds.
     */
    getBuildingEffectiveHydrology: (state) => (buildingId: number, buildingProps?: any) => {
      const toren = state.interventions.find((i) => i.buildingId === buildingId && i.type === 'rooftop_toren')
      const torenStorageM3 = toren ? Number(toren.storageM3 || 0) : 0

      // Baseline roof runoff for design storm (100mm / 24hr)
      const baselineRoofRunoffM3 = Number(buildingProps?.roof_runoff_vol_m3) || (Number(buildingProps?.area || 200) * 0.0948)
      const netRoofRunoffM3 = Math.max(0, Number((baselineRoofRunoffM3 - torenStorageM3).toFixed(2)))
      const roofRetentionPct = baselineRoofRunoffM3 > 0
        ? Math.min(100, Math.round(((baselineRoofRunoffM3 - netRoofRunoffM3) / baselineRoofRunoffM3) * 100))
        : 0

      // Spatial Ground Attenuation (Catchment Zone of Influence)
      let groundReliefM3 = 0
      const bldgLon = Number(buildingProps?.centroid_x ?? buildingProps?.lon ?? 0)
      const bldgLat = Number(buildingProps?.centroid_y ?? buildingProps?.lat ?? 0)

      if (bldgLon !== 0 && bldgLat !== 0) {
        // 1. Dry wells (Radius of influence: 45m)
        const dryWells = state.interventions.filter((i) => i.type === 'ground_dry_well')
        for (const dw of dryWells) {
          if (dw.coordinates && dw.coordinates.length >= 2) {
            const d = computeDistanceM(bldgLon, bldgLat, dw.coordinates[0], dw.coordinates[1])
            if (d <= 45) {
              const weight = 1 - (d / 45)
              groundReliefM3 += (Number(dw.storageM3) || 2.0) * weight
            }
          }
        }

        // 2. Retention ponds (Radius of influence: 120m)
        const ponds = state.interventions.filter((i) => i.type === 'ground_retention_pond')
        for (const p of ponds) {
          let pLon = 0
          let pLat = 0
          if (p.coordinates && p.coordinates.length >= 2) {
            pLon = p.coordinates[0]
            pLat = p.coordinates[1]
          } else if (p.polygon && p.polygon.length > 0) {
            pLon = p.polygon.reduce((sum: number, pt: number[]) => sum + pt[0], 0) / p.polygon.length
            pLat = p.polygon.reduce((sum: number, pt: number[]) => sum + pt[1], 0) / p.polygon.length
          }

          if (pLon !== 0 && pLat !== 0) {
            const d = computeDistanceM(bldgLon, bldgLat, pLon, pLat)
            if (d <= 120) {
              const weight = 1 - (d / 120)
              groundReliefM3 += Math.min(250, (Number(p.storageM3) || 50.0) * weight)
            }
          }
        }
      }

      // Total overland flow reduction at perimeter buffer
      const baselineAdjacentFlowM3 = Number(buildingProps?.adjacent_flood_risk_m3) || 12.0
      const baselinePondDepthM = Number(buildingProps?.adjacent_max_pond_depth_m) || 0
      const totalFlowReductionM3 = Number((torenStorageM3 + groundReliefM3).toFixed(2))

      // Risk Level Classification (matching DEMNAS flow routing thresholds)
      const baselineLevel = buildingProps?.flood_risk_level || classifyFloodRisk(baselineAdjacentFlowM3, baselinePondDepthM)
      const hasRelief = totalFlowReductionM3 > 0

      // If no intervention relief, effective strictly equals baseline!
      const effectiveAdjacentFlowM3 = hasRelief
        ? Math.max(0, Number((baselineAdjacentFlowM3 - totalFlowReductionM3).toFixed(2)))
        : baselineAdjacentFlowM3

      const reliefRatio = baselineAdjacentFlowM3 > 0 ? Math.min(1, totalFlowReductionM3 / baselineAdjacentFlowM3) : 0
      const effectivePondDepthM = Math.max(0, Number((baselinePondDepthM * (1 - reliefRatio)).toFixed(2)))

      const effectiveLevel = hasRelief
        ? classifyFloodRisk(effectiveAdjacentFlowM3, effectivePondDepthM)
        : baselineLevel

      const ranks: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 }
      const isDowngraded = hasRelief && ((ranks[effectiveLevel] || 1) < (ranks[baselineLevel] || 1))
      const isMitigated = hasRelief && (isDowngraded || roofRetentionPct > 0)

      return {
        baselineRoofRunoffM3: Number(baselineRoofRunoffM3.toFixed(1)),
        netRoofRunoffM3,
        roofRetentionPct,
        torenStorageM3,
        groundReliefM3: Number(groundReliefM3.toFixed(1)),
        baselineAdjacentFlowM3,
        effectiveAdjacentFlowM3,
        baselineLevel,
        effectiveLevel,
        isDowngraded,
        isMitigated,
        hasRelief
      }
    },

    /**
     * 25-Year Lifecycle Cost Analysis (LCC) under Permen ESDM No. 2 Tahun 2024
     * Institutional daytime self-consumption (PLN B-3 tariff @ Rp 1,444.70/kWh)
     * and voluntary carbon offsets (IDXCarbon @ Rp 69,600/ton)
     */
    financialLifecycle: (state) => {
      const capexIdr = state.interventions.reduce((sum, item) => sum + item.costIdr, 0)
      const year1SolarCleanEnergyKWh = state.interventions
        .filter((i) => i.type === 'solar_rooftop')
        .reduce((sum, i) => sum + (Number(i.energyMWhYr || i.cleanEnergyMWh) || 0) * 1000, 0)

      const plnTariff = 1444.70 // Rp/kWh (PLN B-3 institutional tariff)
      const carbonPrice = 69600.0 // Rp/ton CO2 (IDXCarbon)
      const discountRate = 0.065 // 6.5% BI benchmark
      const inflationRate = 0.03 // 3% inflation
      const degradationRate = 0.0055 // 0.55% annual PV degradation
      const annualOpexRatio = 0.012 // 1.2% initial CapEx annual O&M

      let cumulativeCashFlow = -capexIdr
      let cumulativeNpv = -capexIdr
      const yearsData = []

      for (let yr = 1; yr <= 25; yr++) {
        const generationKWh = year1SolarCleanEnergyKWh * Math.pow(1 - degradationRate, yr - 1)
        const billSavings = generationKWh * plnTariff
        const co2Tons = (generationKWh * 0.79) / 1000
        const carbonRevenue = co2Tons * carbonPrice

        // Annual OpEx with inflation + inverter replacement at Year 12 (15% of CapEx)
        let opex = capexIdr * annualOpexRatio * Math.pow(1 + inflationRate, yr - 1)
        if (yr === 12 && year1SolarCleanEnergyKWh > 0) {
          opex += capexIdr * 0.15
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

      // Find breakeven year
      const breakevenEntry = yearsData.find((d) => d.cumulativeCashFlowIdr >= 0)
      const breakevenYear = breakevenEntry ? breakevenEntry.year : null

      const year1NetCashFlow = yearsData[0]?.netCashFlowIdr || 0
      const simplePaybackYears = capexIdr > 0 && year1NetCashFlow > 0
        ? Number((capexIdr / year1NetCashFlow).toFixed(1))
        : null

      const total25yrSavingsIdr = yearsData.reduce((sum, d) => sum + d.billSavingsIdr + d.carbonRevenueIdr, 0)
      const roi25yrPct = capexIdr > 0
        ? Math.round(((cumulativeCashFlow) / capexIdr) * 100)
        : 0

      return {
        capexIdr,
        yearsData,
        breakevenYear,
        simplePaybackYears,
        npv25yrIdr: Math.round(cumulativeNpv),
        total25yrSavingsIdr: Math.round(total25yrSavingsIdr),
        roi25yrPct
      }
    },

    /**
     * Identifies "Lower-Hanging Fruit" candidate buildings across campus
     */
    candidateBuildings: () => (buildings: any[]) => {
      if (!buildings || !buildings.length) {
        return { solar: [], flood: [], thermal: [] }
      }

      const solar = buildings
        .filter((b) => {
          const props = b.properties || b
          const area = Number(props.area) || 0
          const pot = Number(props.pot_energy_mean) || 0
          const shade = Number(props.l_shade_mean) || 0
          const specificYield = area > 0 ? pot / (area * 0.2) : 0
          return specificYield >= 1250 && shade < 0.15 && area >= 250
        })
        .sort((a, b) => (Number(b.properties?.pot_energy_mean) || 0) - (Number(a.properties?.pot_energy_mean) || 0))
        .slice(0, 15)
        .map((b) => b.properties?.id || b.id)

      const flood = buildings
        .filter((b) => {
          const props = b.properties || b
          return props.flood_risk_level === 'Critical' || props.flood_risk_level === 'High'
        })
        .sort((a, b) => (Number(b.properties?.adjacent_flood_risk_m3) || 0) - (Number(a.properties?.adjacent_flood_risk_m3) || 0))
        .slice(0, 15)
        .map((b) => b.properties?.id || b.id)

      const thermal = buildings
        .filter((b) => {
          const props = b.properties || b
          return (Number(props.l_shade_mean) || 0) > 0.20 || (Number(props.height_google) || 0) > 12
        })
        .slice(0, 15)
        .map((b) => b.properties?.id || b.id)

      return { solar, flood, thermal }
    },

    /**
     * Campus-wide back-coupled hydrology metrics
     */
    campusHydrologyImpact: (state) => {
      const torenTotalM3 = state.interventions
        .filter((i) => i.type === 'rooftop_toren')
        .reduce((sum, i) => sum + (Number(i.storageM3) || 0), 0)

      const dryWellsTotalM3 = state.interventions
        .filter((i) => i.type === 'ground_dry_well')
        .reduce((sum, i) => sum + (Number(i.storageM3) || 0), 0)

      const pondsTotalM3 = state.interventions
        .filter((i) => i.type === 'ground_retention_pond')
        .reduce((sum, i) => sum + (Number(i.storageM3) || 0), 0)

      const totalRetainedM3 = Number((torenTotalM3 + dryWellsTotalM3 + pondsTotalM3).toFixed(1))
      // Total campus structural roof runoff (~15,500 m3 in 100mm storm)
      const estimatedCampusRoofRunoffM3 = 15500
      const campusRetentionRatePct = Math.min(100, Math.round((totalRetainedM3 / estimatedCampusRoofRunoffM3) * 100))

      const torenBuildingIds = new Set(
        state.interventions.filter((i) => i.type === 'rooftop_toren' && i.buildingId).map((i) => i.buildingId!)
      )

      return {
        totalRetainedM3,
        torenTotalM3: Number(torenTotalM3.toFixed(1)),
        dryWellsTotalM3: Number(dryWellsTotalM3.toFixed(1)),
        pondsTotalM3: Number(pondsTotalM3.toFixed(1)),
        campusRetentionRatePct,
        activeTorenBuildingsCount: torenBuildingIds.size
      }
    }
  },

  actions: {
    addIntervention(item: InterventionItem) {
      this.interventions.push(item)
      persistInterventions(this.interventions)
    },

    toggleDashboard() {
      this.showDashboard = !this.showDashboard
    },

    openDashboard() {
      this.showDashboard = true
    },

    closeDashboard() {
      this.showDashboard = false
    },

    saveBuildingSolar(item: InterventionItem) {
      this.interventions = this.interventions.filter(
        (i) => !(i.buildingId === item.buildingId && i.type === 'solar_rooftop')
      )
      if (item.quantity > 0) {
        this.interventions.push(item)
      }
      persistInterventions(this.interventions)
    },

    saveBuildingGreening(item: InterventionItem) {
      this.interventions = this.interventions.filter(
        (i) => !(i.buildingId === item.buildingId && i.type === 'vertical_greening')
      )
      if (item.quantity > 0) {
        this.interventions.push(item)
      }
      persistInterventions(this.interventions)
    },

    saveBuildingToren(item: InterventionItem) {
      this.interventions = this.interventions.filter(
        (i) => !(i.buildingId === item.buildingId && i.type === 'rooftop_toren')
      )
      if (item.quantity > 0) {
        this.interventions.push(item)
      }
      persistInterventions(this.interventions)
    },

    removeIntervention(id: string) {
      this.interventions = this.interventions.filter((i) => i.id !== id)
      persistInterventions(this.interventions)
    },

    clearAllInterventions() {
      this.interventions = []
      persistInterventions(this.interventions)
    },

    exportScenarioJson() {
      const data = {
        title: 'ITS Surabaya Digital Twin Scenario Report',
        date: new Date().toISOString(),
        summary: {
          totalCapExIdr: this.totalCapExIdr,
          totalCo2OffsetTons: this.totalCo2OffsetTons,
          totalCleanEnergyMWh: this.totalCleanEnergyMWh,
          totalAnnualBillSavingsIdr: this.totalAnnualBillSavingsIdr,
          totalStorageAddedM3: this.totalStorageAddedM3,
          simplePaybackYears: this.simplePaybackYears
        },
        interventions: this.interventions
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `its-dt-scenario-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }
})
