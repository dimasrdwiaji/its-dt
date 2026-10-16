import { GeoJsonLayer, ColumnLayer, PolygonLayer, BitmapLayer } from '@deck.gl/layers'
import { ScenegraphLayer } from '@deck.gl/mesh-layers'
import { GLTFLoader } from '@loaders.gl/gltf'
import { getBuildingColor, COBALT_HIGHLIGHT } from '@/constants/colorRamps'
import type { useMapStore } from '@/stores/mapStore'
import { useScenarioStore } from '@/stores/scenarioStore'

export function useDeckLayers(store: ReturnType<typeof useMapStore>) {
  const scenarioStore = useScenarioStore()

  function getLayers() {
    const layers: any[] = []

    // 0. Active GeoTIFF Raster Overlays
    for (const r of store.rasterLayers) {
      const activeCfg = store.activeRasters[r.id]
      if (activeCfg?.visible) {
        layers.push(
          new BitmapLayer({
            id: `raster-${r.id}`,
            image: r.static_image || `/data/rasters/${r.id}.png`,
            bounds: r.bounds,
            opacity: activeCfg.opacity ?? 0.8,
            pickable: false
          })
        )
      }
    }

    // 0b. Campus Geospatial Road & Pathway Network
    if (store.layersVisibility.roads && store.roadData?.features?.length) {
      layers.push(
        new GeoJsonLayer({
          id: 'campus-roads',
          data: store.roadData.features,
          stroked: true,
          filled: false,
          lineWidthUnits: 'meters',
          getLineWidth: (f: any) => {
            const hwy = f.properties?.highway
            if (hwy === 'primary' || hwy === 'primary_link') return 7.0
            if (hwy === 'secondary' || hwy === 'secondary_link') return 5.5
            if (hwy === 'tertiary' || hwy === 'tertiary_link') return 4.0
            if (hwy === 'service' || hwy === 'residential') return 3.2
            return 2.0
          },
          lineWidthMinPixels: 1.5,
          getLineColor: (f: any) => {
            const hwy = f.properties?.highway
            if (hwy === 'primary' || hwy === 'primary_link') return [56, 189, 248, 220] // Bright cyan
            if (hwy === 'secondary' || hwy === 'secondary_link') return [14, 165, 233, 190]
            if (hwy === 'tertiary' || hwy === 'tertiary_link') return [148, 163, 184, 170]
            if (hwy === 'footway' || hwy === 'pedestrian' || hwy === 'cycleway') return [52, 211, 153, 160] // Emerald pedestrian path
            return [100, 116, 139, 140]
          },
          pickable: false
        })
      )
    }

    // 1. Campus Buildings LoD1 Extruded Layer
    if (store.layersVisibility.buildings && store.buildingData?.features?.length) {
      layers.push(
        new GeoJsonLayer({
          id: 'buildings-3d',
          data: store.buildingData.features,
          filled: true,
          extruded: true,
          wireframe: false,
          pickable: true,
          autoHighlight: true,
          highlightColor: COBALT_HIGHLIGHT,
          getElevation: (f: any) => {
            const h = f.properties?.height_google || f.properties?.height_osm || 8
            return Math.max(4, Number(h))
          },
          getFillColor: (f: any) => {
            // Selected building highlight
            if (store.selectedBuilding && f.properties?.id === store.selectedBuilding.id) {
              return [26, 86, 219, 255]
            }

            // If solar installed on roof, tint with distinctive solar panel navy
            const solar = scenarioStore.getBuildingSolar(f.properties?.id)
            if (solar && solar.metadata?.showPanels !== false && store.colorMode === 'energy') {
              return [30, 41, 59, 250] // Dark solar panel glass
            }

            // If vertical greening installed, tint facade with foliage green
            const greening = scenarioStore.getBuildingGreening(f.properties?.id)
            if (greening && greening.metadata?.showGreening !== false && store.colorMode === 'ecology') {
              return [16, 110, 60, 245] // Deep foliage green
            }

            // Hydrology back-coupling: dynamically tint building based on mitigated overland runoff
            if (store.colorMode === 'hydrology') {
              const hydro = scenarioStore.getBuildingEffectiveHydrology(f.properties?.id, f.properties)
              return getBuildingColor({ ...f.properties, adjacent_flood_risk_m3: hydro.effectiveAdjacentFlowM3 }, 'hydrology')
            }

            // Normal thematic ramp
            return getBuildingColor(f.properties, store.colorMode)
          },
          getLineColor: (f: any) => {
            // Low-Hanging Fruit highlight borders
            if (store.lowHangingFruitFilter !== 'none' && store.buildingData?.features?.length) {
              const candidates = scenarioStore.candidateBuildings(store.buildingData.features)
              const bldgId = f.properties?.id
              if (store.lowHangingFruitFilter === 'solar' && candidates.solar.includes(bldgId)) {
                return [251, 191, 36, 255] // Golden candidate halo
              }
              if (store.lowHangingFruitFilter === 'flood' && candidates.flood.includes(bldgId)) {
                return [14, 165, 233, 255] // Sky blue candidate halo
              }
              if (store.lowHangingFruitFilter === 'thermal' && candidates.thermal.includes(bldgId)) {
                return [52, 211, 153, 255] // Emerald candidate halo
              }
            }

            // Solar active wireframe / border amber
            const solar = scenarioStore.getBuildingSolar(f.properties?.id)
            if (solar && solar.metadata?.showPanels !== false && store.colorMode === 'energy') {
              return [245, 158, 11, 230] // Solar gold border
            }

            // Vertical greening active border
            const greening = scenarioStore.getBuildingGreening(f.properties?.id)
            if (greening && greening.metadata?.showGreening !== false && store.colorMode === 'ecology') {
              return [52, 211, 153, 230] // Emerald border
            }

            // Toren active border
            const toren = scenarioStore.getBuildingToren(f.properties?.id)
            if (toren && toren.metadata?.showToren !== false && store.colorMode === 'hydrology') {
              return [56, 189, 248, 230] // Sky blue border
            }

            return [148, 163, 184, 80]
          },
          getLineWidth: (f: any) => {
            if (store.lowHangingFruitFilter !== 'none' && store.buildingData?.features?.length) {
              const candidates = scenarioStore.candidateBuildings(store.buildingData.features)
              const bldgId = f.properties?.id
              if (
                (store.lowHangingFruitFilter === 'solar' && candidates.solar.includes(bldgId)) ||
                (store.lowHangingFruitFilter === 'flood' && candidates.flood.includes(bldgId)) ||
                (store.lowHangingFruitFilter === 'thermal' && candidates.thermal.includes(bldgId))
              ) {
                return 4
              }
            }
            return 1
          },
          lineWidthMinPixels: 1,
          updateTriggers: {
            getFillColor: [store.colorMode, store.selectedBuilding?.id, scenarioStore.interventions.length, scenarioStore.totalStorageAddedM3],
            getLineColor: [store.colorMode, store.selectedBuilding?.id, scenarioStore.interventions.length, scenarioStore.totalStorageAddedM3, store.lowHangingFruitFilter],
            getLineWidth: [store.lowHangingFruitFilter]
          },
          onClick: (info: any) => {
            if (store.activeTool === 'info') {
              if (info.object) {
                store.setSelectedBuilding(info.object.properties)
              } else {
                store.setSelectedBuilding(null)
              }
            }
          }
        })
      )
    }

    // 2. Planted Trees Visuals (3D GLTF Model OR Procedural Canopies)
    const trees = scenarioStore.getPlantedTrees
    if (trees.length > 0) {
      if (store.tree3DModel) {
        // Scenegraph 3D Mesh Layer using tree.glb
        layers.push(
          new ScenegraphLayer({
            id: 'tree-3d-models',
            data: trees,
            scenegraph: '/tree.glb',
            loaders: [GLTFLoader],
            getPosition: (d: any) => [d.coordinates[0], d.coordinates[1], 0],
            getOrientation: [0, 0, 90],
            sizeScale: 4.5,
            pickable: true,
            autoHighlight: true,
            highlightColor: [52, 211, 153, 240],
            onClick: (info: any) => {
              if (info.object) {
                store.setLatestPrediction({
                  ...info.object.metadata,
                  intervention: info.object.name,
                  lat: info.object.coordinates[1],
                  lon: info.object.coordinates[0],
                  cost_idr: info.object.costIdr,
                  co2_mitigation_kg_yr: info.object.co2OffsetKgYr,
                  delta_c: info.object.coolingDeltaC,
                  baseline_lst_c: info.object.metadata?.baselineLst,
                  new_lst_c: info.object.metadata?.newLst,
                  canopy_radius_m: info.object.metadata?.canopyRadiusM
                })
              }
            }
          })
        )
      } else {
        // Procedural Trunks (only for true trees, omitted for shrubs & groundcover)
        layers.push(
          new ColumnLayer({
            id: 'tree-trunks',
            data: trees.filter((t: any) => !t.metadata?.speciesId?.startsWith('shrub_') && !t.metadata?.speciesId?.startsWith('ground_')),
            diskResolution: 8,
            radius: 0.8,
            extruded: true,
            getElevation: (d: any) => d.metadata?.speciesId === 'tree_trembesi' ? 5.5 : 3.8,
            getPosition: (d: any) => d.coordinates,
            getFillColor: [110, 75, 40, 255],
            pickable: false
          })
        )

        // Procedural 3D Elevated Foliage Canopies
        layers.push(
          new ColumnLayer({
            id: 'tree-canopies',
            data: trees,
            diskResolution: 20,
            radius: (d: any) => d.metadata?.canopyRadiusM || 4.5,
            extruded: true,
            getElevation: (d: any) => {
              const sp = d.metadata?.speciesId
              if (sp?.startsWith('ground_')) return 0.25
              if (sp?.startsWith('shrub_')) return 1.8
              if (sp === 'tree_trembesi') return 9.5
              return 6.5
            },
            getPosition: (d: any) => d.coordinates,
            getFillColor: (d: any) => {
              const sp = d.metadata?.speciesId
              if (sp === 'tree_tabebuya') return [250, 204, 21, 235] // Golden flower blossom
              if (sp === 'tree_trembesi') return [22, 163, 74, 230] // Forest green
              if (sp === 'tree_angsana') return [34, 197, 94, 230] // Leaf green
              if (sp === 'tree_ketapang_kencana') return [16, 185, 129, 230] // Vibrant emerald
              if (sp === 'shrub_pucuk_merah') return [239, 68, 68, 230] // Crimson red-orange
              if (sp === 'shrub_bougainvillea') return [236, 72, 153, 230] // Magenta
              if (sp === 'ground_rumput_gajah_mini') return [132, 204, 22, 210] // Turf lime green
              return [34, 197, 94, 220]
            },
            getLineColor: (d: any) => {
              const sp = d.metadata?.speciesId
              if (sp === 'tree_tabebuya') return [202, 138, 4, 240]
              if (sp === 'shrub_pucuk_merah') return [185, 28, 28, 240]
              if (sp === 'shrub_bougainvillea') return [190, 24, 93, 240]
              return [20, 83, 45, 240]
            },
            lineWidthMinPixels: 1.5,
            pickable: true,
            autoHighlight: true,
            highlightColor: [52, 211, 153, 240],
            onClick: (info: any) => {
              if (info.object) {
                store.setLatestPrediction({
                  ...info.object.metadata,
                  intervention: info.object.name,
                  lat: info.object.coordinates[1],
                  lon: info.object.coordinates[0],
                  cost_idr: info.object.costIdr,
                  co2_mitigation_kg_yr: info.object.co2OffsetKgYr,
                  delta_c: info.object.coolingDeltaC,
                  baseline_lst_c: info.object.metadata?.baselineLst,
                  new_lst_c: info.object.metadata?.newLst,
                  canopy_radius_m: info.object.metadata?.canopyRadiusM
                })
              }
            }
          })
        )
      }
    }

    // 3. Ground Interventions: Modular Dry Wells (Sumur Resapan)
    const dryWells = scenarioStore.getDryWells
    if (dryWells.length > 0) {
      // 3a. Infiltration Catchment Zone (Radius: 45m)
      layers.push(
        new ColumnLayer({
          id: 'dry-wells-catchment',
          data: dryWells,
          diskResolution: 36,
          radius: 45,
          extruded: false,
          elevation: 0.1,
          getPosition: (d: any) => d.coordinates,
          getFillColor: [14, 165, 233, 25], // Subtle sky wash
          getLineColor: [14, 165, 233, 100],
          lineWidthMinPixels: 1.5,
          stroked: true,
          filled: true,
          pickable: false
        })
      )

      // Outer Casing Ring
      layers.push(
        new ColumnLayer({
          id: 'dry-wells-casing',
          data: dryWells,
          diskResolution: 12,
          radius: 1.0,
          extruded: true,
          getElevation: 0.8,
          getPosition: (d: any) => d.coordinates,
          getFillColor: [14, 165, 233, 230],
          getLineColor: [2, 132, 199, 255],
          lineWidthMinPixels: 2,
          pickable: true,
          autoHighlight: true,
          highlightColor: [125, 211, 252, 250],
          onClick: (info: any) => {
            if (info.object) {
              store.setSelectedDryWell(info.object)
            }
          }
        })
      )

      // Inner Perforated Infiltration Core
      layers.push(
        new ColumnLayer({
          id: 'dry-wells-core',
          data: dryWells,
          diskResolution: 10,
          radius: 0.5,
          extruded: true,
          getElevation: 0.9,
          getPosition: (d: any) => d.coordinates,
          getFillColor: [3, 105, 161, 240],
          pickable: false
        })
      )
    }

    // 4. Ground Interventions: Completed Retention Ponds (Kolam Retensi)
    const ponds = scenarioStore.getRetentionPonds
    if (ponds.length > 0) {
      // 4a. Catchment Area of Influence (Radius: 120m)
      const pondCentroids = ponds
        .map((p) => {
          let center = [0, 0]
          if (p.coordinates && p.coordinates.length >= 2) {
            center = p.coordinates
          } else if (p.polygon && p.polygon.length > 0) {
            center = [
              p.polygon.reduce((sum: number, pt: number[]) => sum + pt[0], 0) / p.polygon.length,
              p.polygon.reduce((sum: number, pt: number[]) => sum + pt[1], 0) / p.polygon.length
            ]
          }
          return { ...p, center }
        })
        .filter((p) => p.center[0] !== 0)

      if (pondCentroids.length > 0) {
        layers.push(
          new ColumnLayer({
            id: 'ponds-catchment',
            data: pondCentroids,
            diskResolution: 48,
            radius: 120,
            extruded: false,
            elevation: 0.1,
            getPosition: (d: any) => d.center,
            getFillColor: [6, 182, 212, 20], // Delicate cyan wash
            getLineColor: [6, 182, 212, 90],
            lineWidthMinPixels: 1.5,
            stroked: true,
            filled: true,
            pickable: false
          })
        )
      }

      layers.push(
        new PolygonLayer({
          id: 'retention-ponds',
          data: ponds,
          getPolygon: (d: any) => d.polygon,
          filled: true,
          stroked: true,
          extruded: false,
          getFillColor: [6, 182, 212, 180], // Translucent aquatic blue
          getLineColor: [8, 145, 178, 255],
          getLineWidth: 3,
          lineWidthMinPixels: 2,
          pickable: true,
          autoHighlight: true,
          highlightColor: [56, 189, 248, 220],
          onClick: (info: any) => {
            if (info.object) {
              store.setSelectedPond(info.object)
            }
          }
        })
      )
    }

    // 5. In-Progress Pond Drawing Visuals
    if (store.pondPoints.length > 0) {
      // 5a. Vertex Markers
      layers.push(
        new ColumnLayer({
          id: 'pond-drawing-vertices',
          data: store.pondPoints.map((coord, idx) => ({ coord, idx })),
          diskResolution: 12,
          radius: 1.5,
          extruded: true,
          getElevation: 1.0,
          getPosition: (d: any) => d.coord,
          getFillColor: [6, 182, 212, 255],
          getLineColor: [255, 255, 255, 255],
          lineWidthMinPixels: 2,
          pickable: false
        })
      )

      // 5b. Boundary Perimeter Lines
      if (store.pondPoints.length >= 2) {
        const lineFeature = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: store.pondPoints
          },
          properties: {}
        }
        layers.push(
          new GeoJsonLayer({
            id: 'pond-drawing-lines',
            data: lineFeature as any,
            getLineColor: [6, 182, 212, 255],
            getLineWidth: 3,
            lineWidthMinPixels: 3
          })
        )
      }

      // 5c. Live Area Preview Fill (when >= 3 vertices)
      if (store.pondPoints.length >= 3) {
        const previewPolygon = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[...store.pondPoints, store.pondPoints[0]]]
          },
          properties: {}
        }
        layers.push(
          new GeoJsonLayer({
            id: 'pond-drawing-preview-fill',
            data: previewPolygon as any,
            filled: true,
            getFillColor: [6, 182, 212, 70],
            stroked: false
          })
        )
      }
    }

    // 6. Measurement line overlay
    if (store.measurePoints.length >= 2) {
      const lineData = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: store.measurePoints
        },
        properties: {}
      }

      layers.push(
        new GeoJsonLayer({
          id: 'measure-line',
          data: lineData as any,
          getLineColor: [56, 189, 248, 255],
          getLineWidth: 3,
          lineWidthMinPixels: 3
        })
      )
    }

    return layers
  }

  return {
    getLayers
  }
}
