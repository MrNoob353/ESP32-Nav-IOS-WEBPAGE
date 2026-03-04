# ESP32-Nav-IOS-WEBPAGE

Simple iOS-friendly map app (OpenStreetMap based) for routing like Google Maps style flow:
- detect current location,
- type destination name,
- draw route and directions,
- send route data to ESP32.

## Flow

1. Connect ESP32 (WebSocket or HTTP)
2. App auto-detects your current location (or tap Detect My Location)
3. Type destination name (example: `Eiffel Tower`)
4. Tap **Route to Destination**
5. Tap **Send to ESP32**

## Routing stack

- Map tiles: OpenStreetMap (Leaflet)
- Destination search: Nominatim (OSM geocoding)
- Route + directions: OSRM public API

## Run

```bash
python3 -m http.server 8080
```

Open on iPhone Safari: `http://<your-ip>:8080`

## Payload example

```json
{
  "timestamp": "2026-03-04T00:00:00.000Z",
  "provider": "openstreetmap+osrm",
  "current": { "lat": 48.8566, "lon": 2.3522 },
  "destination": { "lat": 48.8583, "lon": 2.2945, "name": "Eiffel Tower, Paris, France" },
  "nav": {
    "distanceKm": 5.8,
    "durationMin": 16.4,
    "bearingDeg": 271.2
  }
}
```


## Troubleshooting (Safari)

- If map CDN is blocked, the app now shows a fallback message and still lets you route/send payload without map rendering.
- Ensure iPhone and host are on same Wi-Fi and use `http://<your-ip>:8080` (not localhost).
- Allow Location permission in Safari.
