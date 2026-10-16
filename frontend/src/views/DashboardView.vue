<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useScenarioStore } from '@/stores/scenarioStore'
import { useMapStore } from '@/stores/mapStore'
import FinancialLifecycleChart from '@/components/scenarios/FinancialLifecycleChart.vue'
import ScenarioComparisonModal from '@/components/scenarios/ScenarioComparisonModal.vue'

const router = useRouter()
const scenarioStore = useScenarioStore()
const mapStore = useMapStore()
const showComparisonModal = ref(false)

function backToTwin() {
  router.push('/twin')
}

// Group interventions by building name or location
interface BoqGroup {
  name: string
  subtotalIdr: number
  items: any[]
}

const groupedInterventions = computed<BoqGroup[]>(() => {
  const groups: Record<string, BoqGroup> = {}

  for (const item of scenarioStore.interventions) {
    const locName = item.buildingName || (item.module === 'ecology' ? 'Roadside Tree Corridors' : 'Campus Ground & Detention')
    if (!groups[locName]) {
      groups[locName] = {
        name: locName,
        subtotalIdr: 0,
        items: []
      }
    }
    groups[locName].items.push(item)
    groups[locName].subtotalIdr += (item.costIdr || 0)
  }

  return Object.values(groups)
})

function locateItemOnMap(item: any) {
  // If building intervention, find building coordinates
  if (item.buildingId && mapStore.buildingData?.features) {
    const bldg = mapStore.buildingData.features.find((f: any) => f.properties?.id === item.buildingId)
    if (bldg && bldg.geometry) {
      const coords = bldg.geometry.coordinates[0][0]
      mapStore.setSelectedBuilding(bldg.properties)
      mapStore.flyToLocation({ lng: coords[0], lat: coords[1], zoom: 17.8, pitch: 45 })
      router.push('/twin')
      return
    }
  }

  // If ground tree, dry well, or pond with coordinates
  if (item.coordinates && item.coordinates.length >= 2) {
    mapStore.flyToLocation({ lng: item.coordinates[0], lat: item.coordinates[1], zoom: 18.2, pitch: 50 })
    router.push('/twin')
    return
  }

  // Fallback to center campus
  mapStore.flyToLocation({ lng: 112.795, lat: -7.282, zoom: 16.5, pitch: 45 })
  router.push('/twin')
}

// Export BOQ to CSV
function exportBoqCsv() {
  if (scenarioStore.interventions.length === 0) return

  const headers = ['Module', 'Location', 'Item Specification', 'Quantity', 'Unit', 'Unit Cost (IDR)', 'Total Cost (IDR)', 'Annual Energy (MWh)', 'CO2 Offset (Tons)']
  const rows = scenarioStore.interventions.map(i => [
    i.module,
    `"${(i.buildingName || 'Campus Ground').replace(/"/g, '""')}"`,
    `"${i.name.replace(/"/g, '""')}"`,
    i.quantity,
    i.unit,
    Math.round(i.costIdr / (i.quantity || 1)),
    i.costIdr,
    i.energyMWhYr || 0,
    i.co2OffsetTons || 0
  ])

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `ITS_DigitalTwin_BOQ_${Date.now()}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<template>
  <div class="dashboard-page">
    <div class="dashboard-container">
      
      <!-- Top Action Bar -->
      <div class="dashboard-header">
        <div>
          <div class="header-tag">Action Plan & Capital Allocation</div>
          <h1 class="header-title">Campus Scenario & Investment Dashboard</h1>
          <p class="header-sub">
            Holistic sustainability evaluation across 100+ campus assets, 25-year financial lifecycle economics, and itemized Bill of Quantities.
          </p>
        </div>
        <div class="header-actions">
          <button class="btn-subtle" @click="showComparisonModal = true">
            <i class="pi pi-sliders-v"></i>
            <span>Compare Mixes</span>
          </button>
          <button
            class="btn-subtle"
            :disabled="scenarioStore.totalInterventionsCount === 0"
            @click="exportBoqCsv"
          >
            <i class="pi pi-download"></i>
            <span>Export BOQ (CSV)</span>
          </button>
          <button class="btn-primary" @click="backToTwin">
            <i class="pi pi-map"></i>
            <span>Back to 3D Map</span>
          </button>
        </div>
      </div>

      <!-- Top KPI Metric Cards -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Total CapEx Investment</span>
          <span class="kpi-val text-main font-mono">
            Rp {{ scenarioStore.totalCapExIdr.toLocaleString('id-ID') }}
          </span>
          <span class="kpi-sub">Across {{ scenarioStore.totalInterventionsCount }} active interventions</span>
        </div>

        <div class="kpi-card">
          <span class="kpi-label">Estimated Simple Payback</span>
          <span class="kpi-val text-solar font-mono">
            {{ scenarioStore.simplePaybackYears ? `${scenarioStore.simplePaybackYears} Years` : 'N/A' }}
          </span>
          <span class="kpi-sub">
            {{ scenarioStore.simplePaybackYears ? 'Net positive return on investment' : 'Add solar to calculate payback' }}
          </span>
        </div>

        <div class="kpi-card">
          <span class="kpi-label">Annual PLN Bill Savings</span>
          <span class="kpi-val text-eco font-mono">
            Rp {{ scenarioStore.totalAnnualBillSavingsIdr.toLocaleString('id-ID') }}
          </span>
          <span class="kpi-sub">Permen ESDM 2/2024 self-consumption</span>
        </div>

        <div class="kpi-card">
          <span class="kpi-label">Stormwater Runoff Retained</span>
          <span class="kpi-val text-hydro font-mono">
            {{ scenarioStore.campusHydrologyImpact.campusRetentionRatePct }}%
          </span>
          <span class="kpi-sub">{{ scenarioStore.campusHydrologyImpact.totalRetainedM3.toLocaleString('id-ID') }} m³ detained per event</span>
        </div>

        <div class="kpi-card">
          <span class="kpi-label">Annual CO2 Mitigated</span>
          <span class="kpi-val text-eco font-mono">
            {{ scenarioStore.totalCo2OffsetTons }} Tons/yr
          </span>
          <span class="kpi-sub">Clean generation & roadside trees</span>
        </div>
      </div>

      <!-- Before vs After Comparison Grid -->
      <section class="section-container">
        <div class="section-title">Before vs After Intervention Comparison</div>
        <div class="comparison-grid">
          
          <!-- Baseline Campus -->
          <div class="compare-card">
            <div class="compare-badge badge-baseline">Baseline Campus (Current State)</div>
            <div class="metric-row">
              <span class="metric-label">Clean Solar Power Production</span>
              <span class="metric-value font-mono">0 MWh / yr (0% clean solar)</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Annual Campus Electricity Bill</span>
              <span class="metric-value font-mono">Rp 26,580,000,000 / yr</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Stormwater Runoff into Drains</span>
              <span class="metric-value font-mono text-solar">12,850 m³ (100% unmitigated)</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Campus Flood Hazard Severity</span>
              <span class="metric-value font-mono text-solar">High Hazard (>50 m³ ponding)</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Average Peak Road Surface Temp (LST)</span>
              <span class="metric-value font-mono">34.8 °C</span>
            </div>
          </div>

          <!-- Planned Scenario Mix -->
          <div class="compare-card">
            <div class="compare-badge badge-scenario">Planned Scenario Mix (After Interventions)</div>
            <div class="metric-row">
              <span class="metric-label">Clean Solar Power Production</span>
              <span class="metric-value font-mono text-eco">
                {{ scenarioStore.totalCleanEnergyMWh.toLocaleString('id-ID') }} MWh / yr
              </span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Annual Campus Electricity Bill</span>
              <span class="metric-value font-mono text-eco">
                Rp {{ (26580000000 - scenarioStore.totalAnnualBillSavingsIdr).toLocaleString('id-ID') }} / yr
              </span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Stormwater Runoff Retained</span>
              <span class="metric-value font-mono text-hydro">
                {{ scenarioStore.campusHydrologyImpact.totalRetainedM3.toLocaleString('id-ID') }} m³ detained ({{ scenarioStore.campusHydrologyImpact.campusRetentionRatePct }}%)
              </span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Campus Flood Hazard Severity</span>
              <span class="metric-value font-mono" :class="scenarioStore.campusHydrologyImpact.campusRetentionRatePct > 50 ? 'text-eco' : 'text-main'">
                {{ scenarioStore.campusHydrologyImpact.campusRetentionRatePct > 50 ? 'Mitigated (Low Risk)' : 'Moderate Risk' }}
              </span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Average Peak Road Surface Temp (LST)</span>
              <span class="metric-value font-mono text-eco">
                {{ scenarioStore.totalCo2OffsetTons > 0 ? '32.1 °C (-2.7 °C cooling)' : '34.8 °C' }}
              </span>
            </div>
          </div>

        </div>
      </section>

      <!-- 25-Year Lifecycle Cashflow Economics -->
      <section v-if="scenarioStore.totalCapExIdr > 0" class="section-container">
        <div class="section-title">25-Year Cumulative Financial Cashflow & Payback Inflection</div>
        <FinancialLifecycleChart />
      </section>

      <!-- Building-Grouped Bill of Quantities (BOQ) -->
      <section class="section-container">
        <div class="section-header-row">
          <div class="section-title">Bill of Quantities (BOQ) Grouped by Building / Location</div>
          <button
            v-if="scenarioStore.totalInterventionsCount > 0"
            class="btn-text-danger"
            @click="scenarioStore.clearAllInterventions()"
          >
            <i class="pi pi-trash"></i>
            <span>Clear All Interventions</span>
          </button>
        </div>

        <div v-if="scenarioStore.totalInterventionsCount === 0" class="empty-state">
          <div class="empty-icon"><i class="pi pi-inbox"></i></div>
          <h4 class="empty-title">No Interventions Added to Scenario Yet</h4>
          <p class="empty-sub">
            Switch to the 3D Digital Twin and enter "Plan Interventions" mode to configure solar roofs, rainwater torens, living walls, or plant curbside trees.
          </p>
          <button class="btn-primary" style="margin-top: 14px;" @click="backToTwin">
            <i class="pi pi-plus"></i>
            <span>Start Planning Interventions</span>
          </button>
        </div>

        <div v-else class="boq-groups-container">
          <div v-for="grp in groupedInterventions" :key="grp.name" class="boq-group-card">
            
            <div class="boq-group-header">
              <div class="flex items-center gap-2">
                <i class="pi pi-building text-muted"></i>
                <span class="group-name">{{ grp.name }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="group-subtotal font-mono">
                  Subtotal: Rp {{ grp.subtotalIdr.toLocaleString('id-ID') }}
                </span>
                <span class="group-count">
                  {{ grp.items.length }} {{ grp.items.length === 1 ? 'item' : 'items' }}
                </span>
              </div>
            </div>

            <table class="boq-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Item Specification</th>
                  <th>Quantity / Dimension</th>
                  <th>Unit Cost (IDR)</th>
                  <th>Subtotal Cost (IDR)</th>
                  <th>Local Impact</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in grp.items" :key="item.id">
                  <td>
                    <span class="module-tag" :class="`tag-${item.module}`">
                      {{ item.module.toUpperCase() }}
                    </span>
                  </td>
                  <td class="font-medium text-main">{{ item.name }}</td>
                  <td class="font-mono">{{ item.quantity }} {{ item.unit }}</td>
                  <td class="font-mono text-muted">
                    Rp {{ Math.round(item.costIdr / (item.quantity || 1)).toLocaleString('id-ID') }}
                  </td>
                  <td class="font-mono font-medium text-main">
                    Rp {{ item.costIdr.toLocaleString('id-ID') }}
                  </td>
                  <td>
                    <span v-if="item.energyMWhYr" class="text-solar font-mono text-xs">
                      +{{ item.energyMWhYr }} MWh/yr
                    </span>
                    <span v-else-if="item.co2OffsetTons" class="text-eco font-mono text-xs">
                      +{{ item.co2OffsetTons }} tCO₂/yr
                    </span>
                    <span v-else-if="item.module === 'hydrology'" class="text-hydro font-mono text-xs">
                      Runoff detention
                    </span>
                    <span v-else class="text-muted text-xs">—</span>
                  </td>
                  <td style="text-align: right;">
                    <div class="table-actions">
                      <button
                        class="btn-icon"
                        title="Locate on 3D Map"
                        @click="locateItemOnMap(item)"
                      >
                        <i class="pi pi-compass"></i>
                        <span>Locate</span>
                      </button>
                      <button
                        class="btn-icon-danger"
                        title="Remove Intervention"
                        @click="scenarioStore.removeIntervention(item.id)"
                      >
                        <i class="pi pi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

          </div>
        </div>
      </section>

    </div>
  </div>

  <!-- Comparison Modal -->
  <ScenarioComparisonModal
    :visible="showComparisonModal"
    @close="showComparisonModal = false"
  />
</template>

<style scoped>
.dashboard-page {
  height: 100%;
  overflow-y: auto;
  background: var(--bg-canvas);
  padding: 32px 24px 60px;
}

.dashboard-container {
  max-width: 1180px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 20px;
}

.header-tag {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.header-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.02em;
  margin: 0 0 6px 0;
}

.header-sub {
  font-size: 13.5px;
  color: var(--text-body);
  max-width: 680px;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-primary {
  height: 34px;
  padding: 0 14px;
  background: var(--text-main);
  color: #ffffff;
  border: 1px solid var(--text-main);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background: #332f2c;
}

.btn-subtle {
  height: 34px;
  padding: 0 14px;
  background: #ffffff;
  color: var(--text-body);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-subtle:hover:not(:disabled) {
  background: var(--bg-subtle);
  color: var(--text-main);
}

.btn-subtle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}

.kpi-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(41, 37, 36, 0.02);
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.kpi-val {
  font-size: 20px;
  font-weight: 700;
  margin: 6px 0 3px;
  letter-spacing: -0.01em;
}

.kpi-sub {
  font-size: 11px;
  color: var(--text-muted);
}

/* Section */
.section-container {
  display: flex;
  flex-direction: column;
}

.section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.btn-text-danger {
  background: transparent;
  border: none;
  color: #dc2626;
  font-size: 11.5px;
  font-weight: 600;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.btn-text-danger:hover {
  background: #fef2f2;
}

/* Comparison Grid */
.comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.compare-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(41, 37, 36, 0.02);
}

.compare-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 3px 8px;
  border-radius: 4px;
  margin-bottom: 14px;
}

.badge-baseline {
  background: var(--bg-subtle);
  color: var(--text-muted);
  border: 1px solid var(--border-subtle);
}

.badge-scenario {
  background: var(--eco-bg);
  color: var(--eco-accent);
  border: 1px solid rgba(21, 128, 61, 0.2);
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f7f5f0;
  font-size: 12.5px;
}

.metric-row:last-child {
  border-bottom: none;
}

.metric-label {
  color: var(--text-body);
}

.metric-value {
  font-weight: 600;
  color: var(--text-main);
}

/* Empty State */
.empty-state {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 48px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--bg-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.empty-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 6px 0;
}

.empty-sub {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 480px;
  margin: 0;
  line-height: 1.5;
}

/* BOQ Group */
.boq-groups-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.boq-group-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(41, 37, 36, 0.02);
}

.boq-group-header {
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border-subtle);
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
}

.group-subtotal {
  font-size: 12px;
  font-weight: 600;
  color: var(--solar-accent);
}

.group-count {
  font-size: 11px;
  color: var(--text-muted);
}

/* BOQ Table */
.boq-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.boq-table th {
  padding: 10px 16px;
  background: #ffffff;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left;
  border-bottom: 1px solid var(--border-subtle);
}

.boq-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #f7f5f0;
  color: var(--text-body);
}

.boq-table tr:last-child td {
  border-bottom: none;
}

.module-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.tag-energy { background: var(--solar-bg); color: var(--solar-accent); }
.tag-hydrology { background: var(--hydro-bg); color: var(--hydro-accent); }
.tag-ecology { background: var(--eco-bg); color: var(--eco-accent); }

.table-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-icon {
  height: 28px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid var(--border-subtle);
  background: #ffffff;
  color: var(--text-main);
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.btn-icon:hover {
  background: var(--bg-subtle);
}

.btn-icon-danger {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  color: #dc2626;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.btn-icon-danger:hover {
  background: #fef2f2;
}

.text-main { color: var(--text-main); }
.text-muted { color: var(--text-muted); }
.text-solar { color: var(--solar-accent); }
.text-hydro { color: var(--hydro-accent); }
.text-eco { color: var(--eco-accent); }
</style>
