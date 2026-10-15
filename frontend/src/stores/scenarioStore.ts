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
  if (qM3 >= 5000 || pondDepthM >= 0.5) return 'Critical'
  if (qM3 >= 1000 || pondDepthM >= 0.25) return 'High'
  if (qM3 >= 250 || pondDepthM >= 0.1) return 'Medium'
  return 'Low'
}

export const useScenarioStore = defineStore('scenario', {
  state: () => ({
    interventions: [] as InterventionItem[],
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
      const totalFlowReductionM3 = Number((torenStorageM3 + groundReliefM3).toFixed(2))
      const effectiveAdjacentFlowM3 = Math.max(0, Number((baselineAdjacentFlowM3 - totalFlowReductionM3).toFixed(2)))

      // Risk Level Classification (matching DEMNAS flow routing thresholds)
      const baselineLevel = buildingProps?.flood_risk_level || classifyFloodRisk(baselineAdjacentFlowM3)
      const effectiveLevel = classifyFloodRisk(effectiveAdjacentFlowM3)

      const ranks: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 }
      const isDowngraded = (ranks[effectiveLevel] || 1) < (ranks[baselineLevel] || 1)
      const isMitigated = isDowngraded || roofRetentionPct > 0

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
        isMitigated
      }
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
    },

    saveBuildingGreening(item: InterventionItem) {
      this.interventions = this.interventions.filter(
        (i) => !(i.buildingId === item.buildingId && i.type === 'vertical_greening')
      )
      if (item.quantity > 0) {
        this.interventions.push(item)
      }
    },

    saveBuildingToren(item: InterventionItem) {
      this.interventions = this.interventions.filter(
        (i) => !(i.buildingId === item.buildingId && i.type === 'rooftop_toren')
      )
      if (item.quantity > 0) {
        this.interventions.push(item)
      }
    },

    removeIntervention(id: string) {
      this.interventions = this.interventions.filter((i) => i.id !== id)
    },

    clearAllInterventions() {
      this.interventions = []
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
