/**
 * Geospatial Road Snapping & Curbside Alignment Engine
 *
 * OpenStreetMap (OSM) highway ways represent road centerlines.
 * This module computes the true physical road edge / curbside planting verge
 * based on transparent Indonesian urban road width standards (Standar Geometri Jalan Perkotaan Bina Marga).
 */

export interface RoadWidthConfig {
  totalWidthM: number
  halfWidthM: number
  plantingVergeM: number
  totalCurbsideOffsetM: number
  description: string
}

export const ROAD_WIDTH_STANDARDS: Record<string, RoadWidthConfig> = {
  primary: {
    totalWidthM: 14.0,
    halfWidthM: 7.0,
    plantingVergeM: 1.5,
    totalCurbsideOffsetM: 8.5,
    description: '4-Lane Primary Boulevard (e.g. Jl. Raya ITS) - 14m carriage + 1.5m sidewalk verge'
  },
  primary_link: {
    totalWidthM: 10.0,
    halfWidthM: 5.0,
    plantingVergeM: 1.2,
    totalCurbsideOffsetM: 6.2,
    description: 'Primary interchange / slip road - 10m carriage + 1.2m verge'
  },
  secondary: {
    totalWidthM: 10.0,
    halfWidthM: 5.0,
    plantingVergeM: 1.2,
    totalCurbsideOffsetM: 6.2,
    description: '2-3 Lane Secondary Avenue - 10m carriage + 1.2m sidewalk verge'
  },
  secondary_link: {
    totalWidthM: 8.0,
    halfWidthM: 4.0,
    plantingVergeM: 1.0,
    totalCurbsideOffsetM: 5.0,
    description: 'Secondary connecting road - 8m carriage + 1.0m verge'
  },
  tertiary: {
    totalWidthM: 7.0,
    halfWidthM: 3.5,
    plantingVergeM: 1.0,
    totalCurbsideOffsetM: 4.5,
    description: 'Campus Main Access Street - 7m carriage + 1.0m curb planting bed'
  },
  tertiary_link: {
    totalWidthM: 6.0,
    halfWidthM: 3.0,
    plantingVergeM: 0.8,
    totalCurbsideOffsetM: 3.8,
    description: 'Tertiary link corridor - 6m carriage + 0.8m verge'
  },
  residential: {
    totalWidthM: 5.0,
    halfWidthM: 2.5,
    plantingVergeM: 0.8,
    totalCurbsideOffsetM: 3.3,
    description: 'Faculty / Department Access Road - 5m carriage + 0.8m verge'
  },
  service: {
    totalWidthM: 5.0,
    halfWidthM: 2.5,
    plantingVergeM: 0.8,
    totalCurbsideOffsetM: 3.3,
    description: 'Internal Service & Laboratory Access Lane - 5m carriage + 0.8m verge'
  },
  living_street: {
    totalWidthM: 4.5,
    halfWidthM: 2.25,
    plantingVergeM: 0.75,
    totalCurbsideOffsetM: 3.0,
    description: 'Shared pedestrian/vehicle campus alley - 4.5m carriage + 0.75m verge'
  },
  pedestrian: {
    totalWidthM: 3.0,
    halfWidthM: 1.5,
    plantingVergeM: 0.6,
    totalCurbsideOffsetM: 2.1,
    description: 'Paved Pedestrian Promenade - 3m width + 0.6m tree planting pit'
  },
  footway: {
    totalWidthM: 2.5,
    halfWidthM: 1.25,
    plantingVergeM: 0.6,
    totalCurbsideOffsetM: 1.85,
    description: 'Pedestrian Campus Footpath - 2.5m walkway + 0.6m tree margin'
  },
  cycleway: {
    totalWidthM: 2.0,
    halfWidthM: 1.0,
    plantingVergeM: 0.5,
    totalCurbsideOffsetM: 1.5,
    description: 'Campus Dedicated Bicycle Lane - 2m width + 0.5m green buffer'
  },
  default: {
    totalWidthM: 5.0,
    halfWidthM: 2.5,
    plantingVergeM: 0.8,
    totalCurbsideOffsetM: 3.3,
    description: 'Standard Urban Road - 5m carriage + 0.8m verge'
  }
}

export function getRoadWidthConfig(highwayType: string): RoadWidthConfig {
  return ROAD_WIDTH_STANDARDS[highwayType] || ROAD_WIDTH_STANDARDS.default
}

export interface SnapResult {
  snapped: boolean
  originalCoord: [number, number]
  snappedCoord: [number, number]
  roadName: string
  highwayType: string
  roadWidthM: number
  curbsideOffsetM: number
  distanceM: number
  description: string
}

/**
 * Metric degree-to-meter conversion at Surabaya latitude (-7.28 deg)
 */
const METERS_PER_DEG_LAT = 110574
const METERS_PER_DEG_LON = 109680

/**
 * Snaps a clicked point (lon, lat) to the nearest road's physical curb/sidewalk verge
 * within snappingThresholdM (default 20 meters).
 */
export function snapPointToRoad(
  lon: number,
  lat: number,
  roadFeatures: any[],
  snappingThresholdM = 20.0
): SnapResult {
  let closestDistM = Infinity
  let bestProj: [number, number] = [lon, lat]
  let bestCurbside: [number, number] = [lon, lat]
  let bestFeature: any = null

  const pX = lon * METERS_PER_DEG_LON
  const pY = lat * METERS_PER_DEG_LAT

  for (const feat of roadFeatures) {
    if (!feat.geometry || feat.geometry.type !== 'LineString') continue
    const coords = feat.geometry.coordinates
    if (!coords || coords.length < 2) continue

    for (let i = 0; i < coords.length - 1; i++) {
      const aLon = coords[i][0]
      const aLat = coords[i][1]
      const bLon = coords[i + 1][0]
      const bLat = coords[i + 1][1]

      const aX = aLon * METERS_PER_DEG_LON
      const aY = aLat * METERS_PER_DEG_LAT
      const bX = bLon * METERS_PER_DEG_LON
      const bY = bLat * METERS_PER_DEG_LAT

      const abX = bX - aX
      const abY = bY - aY
      const abLenSq = abX * abX + abY * abY
      if (abLenSq === 0) continue

      // Projection factor t in [0, 1]
      let t = ((pX - aX) * abX + (pY - aY) * abY) / abLenSq
      t = Math.max(0, Math.min(1, t))

      const projX = aX + t * abX
      const projY = aY + t * abY

      const diffX = pX - projX
      const diffY = pY - projY
      const distM = Math.sqrt(diffX * diffX + diffY * diffY)

      if (distM < closestDistM) {
        closestDistM = distM
        bestProj = [projX / METERS_PER_DEG_LON, projY / METERS_PER_DEG_LAT]
        bestFeature = feat

        // Determine which side of the centerline the user clicked
        // Cross-product (2D determinant): (B - A) x (P - A)
        const cross = abX * (pY - aY) - abY * (pX - aX)
        const sideSign = cross >= 0 ? 1 : -1

        // Unit normal vector perpendicular to segment
        const segLen = Math.sqrt(abLenSq)
        const normX = -abY / segLen
        const normY = abX / segLen

        const hwyType = feat.properties?.highway || 'default'
        const widthCfg = getRoadWidthConfig(hwyType)
        const offsetM = widthCfg.totalCurbsideOffsetM

        // Shift by curbside offset to the clicked side
        const curbX = projX + normX * offsetM * sideSign
        const curbY = projY + normY * offsetM * sideSign

        bestCurbside = [curbX / METERS_PER_DEG_LON, curbY / METERS_PER_DEG_LAT]
      }
    }
  }

  if (closestDistM <= snappingThresholdM && bestFeature) {
    const hwyType = bestFeature.properties?.highway || 'default'
    const widthCfg = getRoadWidthConfig(hwyType)
    return {
      snapped: true,
      originalCoord: [lon, lat],
      snappedCoord: bestCurbside,
      roadName: bestFeature.properties?.name || 'Jl. Kampus ITS',
      highwayType: hwyType,
      roadWidthM: widthCfg.totalWidthM,
      curbsideOffsetM: widthCfg.totalCurbsideOffsetM,
      distanceM: Number(closestDistM.toFixed(1)),
      description: widthCfg.description
    }
  }

  return {
    snapped: false,
    originalCoord: [lon, lat],
    snappedCoord: [lon, lat],
    roadName: '',
    highwayType: '',
    roadWidthM: 0,
    curbsideOffsetM: 0,
    distanceM: Number(closestDistM.toFixed(1)),
    description: 'No road within 20m snapping threshold'
  }
}
