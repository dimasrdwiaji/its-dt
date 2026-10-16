<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMapStore } from '@/stores/mapStore'
import { useScenarioStore } from '@/stores/scenarioStore'

const route = useRoute()
const router = useRouter()
const mapStore = useMapStore()
const scenarioStore = useScenarioStore()

const isTwinRoute = computed(() => route.path === '/twin')

function navigateTo(path: string) {
  router.push(path)
}
</script>

<template>
  <header class="global-navbar">
    <!-- Brand / Logo -->
    <div class="nav-brand" @click="navigateTo('/')">
      <div class="brand-icon">
        <i class="pi pi-compass"></i>
      </div>
      <div class="brand-text">
        <span class="brand-title">ITS Digital Twin</span>
        <span class="brand-subtitle">Campus Spatial Suite</span>
      </div>
    </div>

    <!-- Navigation Links -->
    <nav class="nav-links">
      <router-link to="/" class="nav-link" active-class="active" exact>
        Overview
      </router-link>
      <router-link to="/twin" class="nav-link" active-class="active">
        3D Digital Twin
      </router-link>
      <router-link to="/dashboard" class="nav-link" active-class="active">
        <span>Scenario Dashboard</span>
        <span v-if="scenarioStore.totalInterventionsCount > 0" class="badge-count">
          {{ scenarioStore.totalInterventionsCount }}
        </span>
      </router-link>
    </nav>

    <!-- Right Campus Meta -->
    <div class="nav-meta">
      <span class="campus-badge">Sukolilo Campus</span>
    </div>
  </header>
</template>

<style scoped>
.global-navbar {
  height: 52px;
  background: #ffffff;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  position: relative;
  z-index: 1000;
  box-shadow: 0 1px 3px rgba(41, 37, 36, 0.03);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.brand-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-main);
  font-size: 13px;
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.brand-subtitle {
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.2;
}

/* Mode Switcher Pill */
.mode-switcher-container {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.mode-pill {
  display: flex;
  background: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 14px;
  font-size: 11.5px;
  font-weight: 600;
  font-family: inherit;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-btn:hover {
  color: var(--text-main);
}

.mode-btn.active {
  background: #ffffff;
  color: var(--text-main);
  box-shadow: 0 1px 3px rgba(41, 37, 36, 0.08);
}

/* Nav Links */
.nav-links {
  display: flex;
  align-items: center;
  gap: 24px;
}

.nav-link {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-muted);
  text-decoration: none;
  padding: 16px 0;
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 0.15s ease;
}

.nav-link:hover {
  color: var(--text-main);
}

.nav-link.active {
  color: var(--text-main);
  font-weight: 600;
}

.nav-link.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--text-main);
}

.badge-count {
  font-size: 10px;
  font-weight: 700;
  background: var(--solar-bg);
  color: var(--solar-accent);
  border: 1px solid rgba(180, 83, 9, 0.2);
  padding: 1px 6px;
  border-radius: 10px;
}

.nav-meta {
  display: flex;
  align-items: center;
}

.campus-badge {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}
</style>
