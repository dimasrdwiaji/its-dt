<script setup lang="ts">
import { useScenarioStore } from '@/stores/scenarioStore'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Divider from 'primevue/divider'

const scenarioStore = useScenarioStore()

function getModuleSeverity(mod: string) {
  switch (mod) {
    case 'energy': return 'warn'
    case 'ecology': return 'success'
    case 'hydrology': return 'info'
    default: return 'secondary'
  }
}

function getModuleIcon(mod: string) {
  switch (mod) {
    case 'energy': return 'pi pi-sun'
    case 'ecology': return 'pi pi-leaf'
    case 'hydrology': return 'pi pi-cloud'
    default: return 'pi pi-circle'
  }
}
</script>

<template>
  <div v-if="scenarioStore.showDashboard" class="scenario-dashboard-backdrop" @click.self="scenarioStore.closeDashboard()">
    <div class="scenario-dashboard-drawer">
      <!-- Header -->
      <div class="drawer-header">
        <div class="flex align-items-center gap-2">
          <i class="pi pi-chart-bar text-primary text-xl"></i>
          <div>
            <h2 class="drawer-title">Campus Scenario Dashboard</h2>
            <span class="drawer-subtitle">Cumulative Planning & Impact Analysis</span>
          </div>
        </div>
        <Button
          icon="pi pi-times"
          text
          rounded
          size="small"
          @click="scenarioStore.closeDashboard()"
        />
      </div>

      <!-- Key Impact KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Total CapEx Investment</span>
          <span class="kpi-val text-primary">Rp {{ scenarioStore.totalCapExIdr.toLocaleString('id-ID') }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Annual PLN Bill Savings</span>
          <span class="kpi-val text-emerald-400">Rp {{ scenarioStore.totalAnnualBillSavingsIdr.toLocaleString('id-ID') }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Clean Solar Energy</span>
          <span class="kpi-val text-yellow-400">{{ scenarioStore.totalCleanEnergyMWh }} MWh/yr</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Estimated Payback</span>
          <span class="kpi-val text-cyan-400">
            {{ scenarioStore.simplePaybackYears ? `${scenarioStore.simplePaybackYears} yrs` : 'N/A' }}
          </span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Annual CO2 Mitigated</span>
          <span class="kpi-val text-green-400">{{ scenarioStore.totalCo2OffsetTons }} tons/yr</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Stormwater Storage Added</span>
          <span class="kpi-val text-sky-400">{{ scenarioStore.totalStorageAddedM3 }} m³</span>
        </div>
      </div>

      <Divider class="my-2" />

      <!-- Interventions List -->
      <div class="interventions-section">
        <div class="flex justify-between items-center mb-2">
          <span class="section-title">ACTIVE INTERVENTIONS ({{ scenarioStore.totalInterventionsCount }})</span>
          <Button
            v-if="scenarioStore.totalInterventionsCount > 0"
            label="Clear All"
            icon="pi pi-trash"
            severity="danger"
            text
            size="small"
            @click="scenarioStore.clearAllInterventions()"
          />
        </div>

        <div v-if="scenarioStore.totalInterventionsCount === 0" class="empty-state">
          <i class="pi pi-inbox text-4xl text-slate-500 mb-2"></i>
          <span class="text-slate-400 font-medium">No interventions added yet.</span>
          <span class="text-slate-500 text-xs mt-1">Select a building on the 3D map to configure Solar, Vertical Greenery, or Toren tanks.</span>
        </div>

        <div v-else class="interventions-list">
          <div
            v-for="item in scenarioStore.interventions"
            :key="item.id"
            class="intervention-row"
          >
            <div class="row-left">
              <div class="flex align-items-center gap-2">
                <Tag
                  :value="item.module.toUpperCase()"
                  :severity="getModuleSeverity(item.module)"
                  size="small"
                />
                <span class="row-title">{{ item.name }}</span>
              </div>
              <span class="row-sub">
                Target: {{ item.buildingName || 'Campus Ground' }} • Quantity: {{ item.quantity }} {{ item.unit }}
              </span>
            </div>

            <div class="row-right">
              <span class="row-cost">Rp {{ item.costIdr.toLocaleString('id-ID') }}</span>
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                size="small"
                @click="scenarioStore.removeIntervention(item.id)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="drawer-footer">
        <Button
          label="Download Scenario Report (JSON)"
          icon="pi pi-download"
          size="small"
          class="w-full"
          :disabled="scenarioStore.totalInterventionsCount === 0"
          @click="scenarioStore.exportScenarioJson()"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.scenario-dashboard-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
}

.scenario-dashboard-drawer {
  width: 480px;
  max-width: 90vw;
  height: 100%;
  background: rgba(15, 23, 42, 0.98);
  border-left: 1px solid rgba(148, 163, 184, 0.16);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
  animation: slideInDrawer 0.25s ease-out;
}

@keyframes slideInDrawer {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  padding-bottom: 12px;
}

.drawer-title {
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
}

.drawer-subtitle {
  font-size: 11px;
  color: #94a3b8;
}

.kpi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.kpi-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.04em;
}

.kpi-val {
  font-size: 15px;
  font-weight: 700;
  margin-top: 4px;
}

.interventions-section {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.05em;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 180px;
  text-align: center;
  padding: 20px;
}

.interventions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.intervention-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
}

.row-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-title {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
}

.row-sub {
  font-size: 11px;
  color: #94a3b8;
}

.row-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.row-cost {
  font-size: 12px;
  font-weight: 700;
  color: #e2e8f0;
}

.drawer-footer {
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding-top: 12px;
}
</style>
