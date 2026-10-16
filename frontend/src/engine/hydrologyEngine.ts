import type { BuildingEffectiveHydrology, FloodRiskLevel } from './types'
import type { InterventionItem } from '@/types/scenario'

/**
 * Computes great-circle distance between two geographic coordinates in meters using Haversine formula.
 */
export function computeDistanceM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000 // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Classifies flood hazard level matching DEMNAS flow routing and Surabaya drainage masterplan thresholds.
 */
export function classifyFloodRisk(qM3: number, pondDepthM: number = 0): FloodRiskLevel {
  if (qM3 >= 50 || pondDepthM >= 0.5) return 'Critical'
  if (qM3 >= 20 || pondDepthM >= 0.25) return 'High'
  if (qM3 >= 5 || pondDepthM >= 0.1) return 'Medium'
  return 'Low'
}

const RISK_RANKS: Record<FloodRiskLevel, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1
}

/**
 * Deep Hydrology Attenuation Engine
 * Evaluates net storm runoff, overland catchment attenuation, and flood risk downgrade
 * for a building given active scenario interventions.
 */
export function evaluateBuildingHydrology(
  buildingId: number,
  buildingProps: any,
  interventions: InterventionItem[]
): BuildingEffectiveHydrology {
  // 1. Rooftop Toren Cistern Retention
  const toren = interventions.find(
    (i) => i.buildingId === buildingId && (i.type === 'rooftop_toren' || i.type === 'water_cistern')
  )
  const torenStorageM3 = toren
    ? Number(toren.storageM3 || (toren.metadata?.storageLiters ? toren.metadata.storageLiters / 1000 : 0))
    : 0

  // Baseline roof runoff for design storm (100mm / 24hr; C=0.95 -> 0.095 m3/m2)
  const bldgArea = Number(buildingProps?.area || 200)
  const baselineRoofRunoffM3 =
    Number(buildingProps?.roof_runoff_vol_m3) || Number((bldgArea * 0.095).toFixed(2))

  const netRoofRunoffM3 = Math.max(0, Number((baselineRoofRunoffM3 - torenStorageM3).toFixed(2)))
  const roofRetentionPct =
    baselineRoofRunoffM3 > 0
      ? Math.min(100, Math.round(((baselineRoofRunoffM3 - netRoofRunoffM3) / baselineRoofRunoffM3) * 100))
      : 0

  // 2. Spatial Ground Catchment Attenuation (Influence of nearby dry wells & ponds)
  let groundReliefM3 = 0
  const bldgLon = Number(buildingProps?.centroid_x ?? buildingProps?.lon ?? 0)
  const bldgLat = Number(buildingProps?.centroid_y ?? buildingProps?.lat ?? 0)

  if (bldgLon !== 0 && bldgLat !== 0) {
    // 2a. Dry Wells (Radius: 45m linear attenuation)
    const dryWells = interventions.filter(
      (i) => i.type === 'ground_dry_well' || i.type === 'dry_well'
    )
    for (const dw of dryWells) {
      if (dw.coordinates && dw.coordinates.length >= 2) {
        const d = computeDistanceM(bldgLon, bldgLat, dw.coordinates[0], dw.coordinates[1])
        if (d <= 45) {
          const weight = 1 - d / 45
          const storage = Number(dw.storageM3 || dw.metadata?.volumeM3 || 2.0)
          groundReliefM3 += storage * weight
        }
      }
    }

    // 2b. Retention Ponds (Radius: 120m linear attenuation)
    const ponds = interventions.filter(
      (i) => i.type === 'ground_retention_pond' || i.type === 'retention_pond'
    )
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
          const weight = 1 - d / 120
          const storage = Number(p.storageM3 || (p.metadata?.areaM2 && p.metadata?.depthM ? p.metadata.areaM2 * p.metadata.depthM : 50.0))
          groundReliefM3 += Math.min(250, storage * weight)
        }
      }
    }
  }

  // 3. Overland Flow Reduction & Effective Risk
  const baselineAdjacentFlowM3 = Number(buildingProps?.adjacent_flood_risk_m3) || 12.0
  const baselinePondDepthM = Number(buildingProps?.adjacent_max_pond_depth_m) || 0
  const totalFlowReductionM3 = Number((torenStorageM3 + groundReliefM3).toFixed(2))

  const baselineLevel: FloodRiskLevel =
    buildingProps?.flood_risk_level || classifyFloodRisk(baselineAdjacentFlowM3, baselinePondDepthM)

  const hasRelief = totalFlowReductionM3 > 0

  const effectiveAdjacentFlowM3 = hasRelief
    ? Math.max(0, Number((baselineAdjacentFlowM3 - totalFlowReductionM3).toFixed(2)))
    : baselineAdjacentFlowM3

  const reliefRatio = baselineAdjacentFlowM3 > 0 ? Math.min(1, totalFlowReductionM3 / baselineAdjacentFlowM3) : 0
  const effectivePondDepthM = Math.max(0, Number((baselinePondDepthM * (1 - reliefRatio)).toFixed(2)))

  const effectiveLevel: FloodRiskLevel = hasRelief
    ? classifyFloodRisk(effectiveAdjacentFlowM3, effectivePondDepthM)
    : baselineLevel

  const isDowngraded = hasRelief && ((RISK_RANKS[effectiveLevel] || 1) < (RISK_RANKS[baselineLevel] || 1))
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
}
