#include <Arduino.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <WiFi.h>

namespace {

constexpr const char* WIFI_SSID = "YOUR_WIFI_SSID";
constexpr const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
constexpr uint16_t HTTP_PORT = 80;

WebServer server(HTTP_PORT);

void printNavPayload(const JsonDocument& doc) {
  const char* turn = doc["turn"] | "unknown";
  int distMeters = doc["dist_meters"] | -1;
  const char* street = doc["street"] | "unknown";

  Serial.println("--- Navigation Payload Received ---");
  Serial.print("Turn: ");
  Serial.println(turn);
  Serial.print("Distance (m): ");
  Serial.println(distMeters);
  Serial.print("Street: ");
  Serial.println(street);
  Serial.println("-----------------------------------");
}

void handleNavPost() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing JSON body\"}");
    return;
  }

  const String body = server.arg("plain");
  StaticJsonDocument<256> jsonDoc;
  DeserializationError err = deserializeJson(jsonDoc, body);

  if (err) {
    Serial.print("JSON parse error: ");
    Serial.println(err.c_str());
    server.send(400, "application/json", "{\"error\":\"Invalid JSON payload\"}");
    return;
  }

  printNavPayload(jsonDoc);
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleNotFound() {
  server.send(404, "application/json", "{\"error\":\"Not found\"}");
}

void connectToWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("Connected. ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

void setupHttpServer() {
  server.on("/nav", HTTP_POST, handleNavPost);
  server.onNotFound(handleNotFound);
  server.begin();

  Serial.print("HTTP server listening on port ");
  Serial.println(HTTP_PORT);
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(500);

  connectToWiFi();
  setupHttpServer();
}

void loop() {
  server.handleClient();
}
