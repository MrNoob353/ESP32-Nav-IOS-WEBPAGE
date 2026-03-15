# ESP32-Nav-IOS-WEBPAGE

Bridge between a Leaflet web dashboard and an ESP32 navigation receiver.

## Files
- `index.html`: Mobile web app that shows map, requests OSRM routes, tracks geolocation, computes distance to next maneuver, and POSTs JSON instructions to ESP32 `/nav`.
- `main.cpp`: Arduino firmware for ESP32 that joins Wi-Fi, hosts `POST /nav`, parses JSON with ArduinoJson, and prints payload to Serial.

## Quick isolation test
1. Flash `main.cpp` to ESP32 after setting `WIFI_SSID` and `WIFI_PASSWORD`.
2. Open Serial Monitor at `115200` baud and note ESP32 IP printed on boot.
3. Serve this directory, for example:
   ```bash
   python3 -m http.server 8080
   ```
4. Open `http://<your-computer-ip>:8080/index.html` on your phone/browser.
5. Enter the ESP32 IP and destination (`lat,lng`), then tap **Set Route**.
6. When approaching a maneuver threshold, the app sends:
   `{"turn":"left|right|straight","dist_meters":<number>,"street":"<name>"}`
7. Verify payload appears in ESP32 Serial Monitor.

## Manual endpoint test (without map)
```bash
curl -i -X POST http://<esp32-ip>/nav \
  -H "Content-Type: application/json" \
  -d '{"turn":"left","dist_meters":200,"street":"Main St"}'
```
