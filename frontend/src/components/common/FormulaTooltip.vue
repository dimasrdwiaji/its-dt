<script setup lang="ts">
import { ref } from 'vue'
import Popover from 'primevue/popover'

interface VariableItem {
  name: string
  value: string
  desc?: string
}

defineProps<{
  title: string
  formula?: string
  plainWords?: string
  variables?: VariableItem[]
  standard?: string
  source?: string
}>()

const op = ref()

function toggle(event: Event) {
  op.value.toggle(event)
}
</script>

<template>
  <span class="formula-tooltip-trigger inline-flex align-items-center ml-1" @click.stop="toggle">
    <i class="pi pi-info-circle info-icon" title="View calculation methodology & formula"></i>

    <Popover ref="op" class="formula-popover-panel">
      <div class="popover-body">
        <!-- Header -->
        <div class="popover-header">
          <i class="pi pi-calculator text-cyan-400 mr-2 text-xs"></i>
          <span class="header-title">{{ title }}</span>
        </div>

        <!-- Plain Words Explanation -->
        <div v-if="plainWords" class="plain-words-section">
          <span class="section-badge">Methodology</span>
          <p class="plain-words-text">{{ plainWords }}</p>
        </div>

        <!-- Mathematical Notation Formula -->
        <div v-if="formula" class="formula-section">
          <span class="section-badge">Mathematical Formulation</span>
          <div class="formula-display">
            <span class="math-formula">{{ formula }}</span>
          </div>
        </div>

        <!-- Variable Breakdown -->
        <div v-if="variables && variables.length" class="variables-list">
          <span class="section-badge">Parameter Values</span>
          <div v-for="v in variables" :key="v.name" class="variable-item">
            <span class="var-name">{{ v.name }}:</span>
            <span class="var-value">{{ v.value }}</span>
            <span v-if="v.desc" class="var-desc">({{ v.desc }})</span>
          </div>
        </div>

        <!-- Regulatory / Empirical Standard -->
        <div v-if="standard" class="meta-section">
          <span class="meta-header">Regulatory / Empirical Standard</span>
          <span class="meta-text">{{ standard }}</span>
        </div>

        <!-- Data Source -->
        <div v-if="source" class="meta-section">
          <span class="meta-header">Data Source</span>
          <span class="meta-text">{{ source }}</span>
        </div>
      </div>
    </Popover>
  </span>
</template>

<style scoped>
.formula-tooltip-trigger {
  cursor: pointer;
  display: inline-flex;
  vertical-align: middle;
}

.info-icon {
  font-size: 11px;
  color: #64748b;
  transition: all 0.15s ease;
}

.info-icon:hover {
  color: #38bdf8;
  transform: scale(1.15);
}

.popover-body {
  width: 300px;
  max-width: 86vw;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 11px;
}

.popover-header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  padding-bottom: 6px;
}

.header-title {
  font-weight: 700;
  color: #f1f5f9;
  font-size: 11.5px;
}

.section-badge {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 3px;
}

.plain-words-section {
  display: flex;
  flex-direction: column;
}

.plain-words-text {
  margin: 0;
  color: #e2e8f0;
  font-size: 11px;
  line-height: 1.45;
  background: rgba(30, 41, 59, 0.6);
  border-left: 3px solid #38bdf8;
  padding: 6px 8px;
  border-radius: 0 6px 6px 0;
}

.formula-section {
  display: flex;
  flex-direction: column;
}

.formula-display {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 6px;
  padding: 7px 10px;
  color: #38bdf8;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}

.math-formula {
  font-family: 'Cambria Math', 'KaTeX_Math', 'Times New Roman', 'Latin Modern Math', Georgia, serif;
  font-style: italic;
  font-size: 12.5px;
  line-height: 1.4;
  letter-spacing: 0.02em;
  color: #7dd3fc;
  word-break: break-word;
}

.variables-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.variable-item {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 10.5px;
  background: rgba(30, 41, 59, 0.4);
  padding: 3px 6px;
  border-radius: 4px;
}

.var-name {
  color: #94a3b8;
  font-weight: 600;
}

.var-value {
  color: #f8fafc;
  font-weight: 700;
}

.var-desc {
  color: #64748b;
  font-size: 9.5px;
}

.meta-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  padding-top: 5px;
}

.meta-header {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.04em;
}

.meta-text {
  color: #cbd5e1;
  font-size: 10px;
  line-height: 1.35;
}
</style>
