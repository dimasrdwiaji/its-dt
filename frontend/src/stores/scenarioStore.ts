import { defineStore } from 'pinia'
import type { InterventionItem } from '@/types/scenario'

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
