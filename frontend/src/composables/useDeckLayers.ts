import { GeoJsonLayer, ColumnLayer, PolygonLayer } from '@deck.gl/layers'
import { ScenegraphLayer } from '@deck.gl/mesh-layers'
import { GLTFLoader } from '@loaders.gl/gltf'
import { getBuildingColor, COBALT_HIGHLIGHT } from '@/constants/colorRamps'
import type { useMapStore } from '@/stores/mapStore'
import { useScenarioStore } from '@/stores/scenarioStore'

export function useDeckLayers(store: ReturnType<typeof useMapStore>) {
  const scenarioStore = useScenarioStore()

  function getLayers() {
    const layers: any[] = []

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

            // Normal thematic ramp
            return getBuildingColor(f.properties, store.colorMode)
          },
          getLineColor: (f: any) => {
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
          lineWidthMinPixels: 1,
          updateTriggers: {
            getFillColor: [store.colorMode, store.selectedBuilding?.id, scenarioStore.interventions.length],
            getLineColor: [store.colorMode, store.selectedBuilding?.id, scenarioStore.interventions.length]
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
        // Procedural Trunks
        layers.push(
          new ColumnLayer({
            id: 'tree-trunks',
            data: trees,
            diskResolution: 8,
            radius: 0.8,
            extruded: true,
            getElevation: 4,
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
            diskResolution: 16,
            radius: (d: any) => d.metadata?.canopyRadiusM || 6,
            extruded: true,
            getElevation: 7,
            getPosition: (d: any) => d.coordinates,
            getFillColor: (d: any) => {
              return d.metadata?.speciesId === 'tree_trembesi'
                ? [22, 163, 74, 220]
                : [34, 197, 94, 220]
            },
            getLineColor: [20, 83, 45, 240],
            lineWidthMinPixels: 2,
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
