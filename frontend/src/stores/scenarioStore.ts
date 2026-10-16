import { defineStore } from 'pinia'
import type { InterventionItem } from '@/types/scenario'
import {
  evaluateBuildingHydrology,
  calculateFinancialLifecycle,
  type BuildingEffectiveHydrology,
  type FinancialLifecycleResult
} from '@/engine'

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
      return Math.round(mwh * 1000 * 1444.70)
    },

    totalStorageAddedM3: (state) => {
      const m3 = state.interventions.reduce((sum, item) => {
        const val = Number(
          item.storageM3 ||
            (item.metadata?.storageLiters ? item.metadata.storageLiters / 1000 : 0) ||
            item.metadata?.volumeM3 ||
            (item.metadata?.areaM2 && item.metadata?.depthM ? item.metadata.areaM2 * item.metadata.depthM : 0) ||
            0
        )
        return sum + val
      }, 0)
      return Number(m3.toFixed(1))
    },

    simplePaybackYears(state): number | null {
      const capex = this.totalCapExIdr
      const savings = this.totalAnnualBillSavingsIdr
      if (savings <= 0 || capex <= 0) return null
      return Number((capex / savings).toFixed(1))
    },

    getBuildingSolar: (state) => (buildingId: number) => {
      return state.interventions.find(
        (i) => i.buildingId === buildingId && (i.type === 'rooftop_pv' || i.type === 'solar_rooftop')
      )
    },

    getBuildingGreening: (state) => (buildingId: number) => {
      return state.interventions.find(
        (i) => i.buildingId === buildingId && (i.type === 'vertical_greening' || i.type === 'green_facade')
      )
    },

    getBuildingToren: (state) => (buildingId: number) => {
      return state.interventions.find(
        (i) => i.buildingId === buildingId && (i.type === 'rooftop_toren' || i.type === 'water_cistern')
      )
    },

    getPlantedTrees: (state) => {
      return state.interventions.filter((i) => i.type === 'ground_tree' || i.type === 'tree')
    },

    getDryWells: (state) => {
      return state.interventions.filter((i) => i.type === 'ground_dry_well' || i.type === 'dry_well')
    },

    getRetentionPonds: (state) => {
      return state.interventions.filter((i) => i.type === 'ground_retention_pond' || i.type === 'retention_pond')
    },

    /**
     * Hydrology Back-Coupling: Evaluates net storm runoff and attenuated flood risk
     * accounting for rooftop toren tanks and spatial catchment influence of nearby dry wells / ponds.
     */
    getBuildingEffectiveHydrology: (state) => (buildingId: number, buildingProps?: any): BuildingEffectiveHydrology => {
      return evaluateBuildingHydrology(buildingId, buildingProps, state.interventions)
    },

    /**
     * 25-Year Lifecycle Cost Analysis (LCC) under Permen ESDM No. 2 Tahun 2024
     * Institutional daytime self-consumption (PLN B-3 tariff @ Rp 1,444.70/kWh)
     * and voluntary carbon offsets (IDXCarbon @ Rp 69,600/ton)
     */
    financialLifecycle: (state): FinancialLifecycleResult => {
      return calculateFinancialLifecycle(state.interventions)
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
        (i) => !(i.buildingId === item.buildingId && (i.type === 'solar_rooftop' || i.type === 'rooftop_pv'))
      )
      if (item.quantity > 0) {
        this.interventions.push(item)
      }
      persistInterventions(this.interventions)
    },

    saveBuildingGreening(item: InterventionItem) {
      this.interventions = this.interventions.filter(
        (i) => !(i.buildingId === item.buildingId && (i.type === 'vertical_greening' || i.type === 'green_facade'))
      )
      if (item.quantity > 0) {
        this.interventions.push(item)
      }
      persistInterventions(this.interventions)
    },

    saveBuildingToren(item: InterventionItem) {
      this.interventions = this.interventions.filter(
        (i) => !(i.buildingId === item.buildingId && (i.type === 'rooftop_toren' || i.type === 'water_cistern'))
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
