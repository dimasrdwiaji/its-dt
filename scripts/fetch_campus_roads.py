"""
Fetch OSM Road and Path Network for ITS Sukolilo Campus
Outputs standard GeoJSON FeatureCollection to:
  - data/roads.geojson
  - frontend/public/data/roads.geojson
"""
import os
import json
import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
DATA_DIR = os.path.join(PROJECT_DIR, "data")
PUBLIC_DATA_DIR = os.path.join(PROJECT_DIR, "frontend", "public", "data")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)

# ITS Campus bounding box [south, west, north, east]
south, west, north, east = -7.295, 112.785, -7.272, 112.805

overpass_query = f"""
[out:json][timeout:30];
(
  way["highway"]({south},{west},{north},{east});
);
out body;
>;
out skel qt;
"""

endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
]

headers = {
    "User-Agent": "ITSSurabayaDigitalTwin/1.0 (academic research; contact@its.ac.id)"
}

print(f"Fetching OSM road network for ITS Campus ({south}, {west}) to ({north}, {east})...")
data = None
for ep in endpoints:
    try:
        print(f"Connecting to: {ep}")
        resp = requests.post(ep, data={"data": overpass_query}, headers=headers, timeout=25)
        if resp.status_code == 200:
            data = resp.json()
            print(f"Successfully received data from {ep}")
            break
        else:
            print(f"Status {resp.status_code} from {ep}")
    except Exception as ex:
        print(f"Connection error to {ep}: {ex}")

if not data or "elements" not in data:
    raise RuntimeError("Failed to retrieve OSM data from all Overpass endpoints.")

nodes = {}
ways = []
for el in data["elements"]:
    if el["type"] == "node":
        nodes[el["id"]] = [round(el["lon"], 6), round(el["lat"], 6)]
    elif el["type"] == "way":
        ways.append(el)

print(f"Parsed {len(nodes)} nodes and {len(ways)} road ways.")

features = []
highway_counts = {}
for w in ways:
    coords = [nodes[nid] for nid in w.get("nodes", []) if nid in nodes]
    if len(coords) >= 2:
        tags = w.get("tags", {})
        hwy_type = tags.get("highway", "unclassified")
        highway_counts[hwy_type] = highway_counts.get(hwy_type, 0) + 1
        
        feat = {
            "type": "Feature",
            "id": w["id"],
            "geometry": {
                "type": "LineString",
                "coordinates": coords
            },
            "properties": {
                "id": w["id"],
                "name": tags.get("name", "Jl. Kampus ITS"),
                "highway": hwy_type,
                "surface": tags.get("surface", "asphalt"),
                "lanes": tags.get("lanes", "1"),
                "oneway": tags.get("oneway", "no")
            }
        }
        features.append(feat)

fc = {
    "type": "FeatureCollection",
    "features": features
}

out_data_path = os.path.join(DATA_DIR, "roads.geojson")
out_public_path = os.path.join(PUBLIC_DATA_DIR, "roads.geojson")

with open(out_data_path, "w", encoding="utf-8") as f:
    json.dump(fc, f, indent=2)

with open(out_public_path, "w", encoding="utf-8") as f:
    json.dump(fc, f, indent=2)

print(f"Saved {len(features)} road features to:")
print(f"  - {out_data_path}")
print(f"  - {out_public_path}")
print("Road types breakdown:")
for k, v in sorted(highway_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"  {k}: {v}")
