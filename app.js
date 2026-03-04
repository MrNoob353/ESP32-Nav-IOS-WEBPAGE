const state = {
  socket: null,
  payload: null,
  current: null,
  destination: null,
  currentMarker: null,
  destinationMarker: null,
  routeLine: null,
};

const el = {
  protocol: document.getElementById('protocol'),
  host: document.getElementById('host'),
  port: document.getElementById('port'),
  path: document.getElementById('path'),
  connectBtn: document.getElementById('connectBtn'),
  connectionStatus: document.getElementById('connectionStatus'),
  currentLabel: document.getElementById('currentLabel'),
  destinationName: document.getElementById('destinationName'),
  locateBtn: document.getElementById('locateBtn'),
  routeBtn: document.getElementById('routeBtn'),
  clearBtn: document.getElementById('clearBtn'),
  sendBtn: document.getElementById('sendBtn'),
  distanceOut: document.getElementById('distanceOut'),
  durationOut: document.getElementById('durationOut'),
  bearingOut: document.getElementById('bearingOut'),
  payloadPreview: document.getElementById('payloadPreview'),
  steps: document.getElementById('steps'),
  log: document.getElementById('log'),
  mapFallback: document.getElementById('mapFallback'),
};

const hasLeaflet = typeof window.L !== 'undefined';
const map = hasLeaflet ? L.map('map').setView([0, 0], 2) : null;
if (hasLeaflet) {
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
} else {
  document.getElementById('map').style.display = 'none';
  el.mapFallback.classList.remove('hidden');
}

function log(msg) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} - ${msg}`;
  el.log.prepend(li);
}

function setConnected(connected) {
  el.connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
  el.connectionStatus.classList.toggle('connected', connected);
}

function endpoint() {
  const mode = el.protocol.value;
  return `${mode === 'ws' ? 'ws' : 'http'}://${el.host.value.trim()}:${el.port.value.trim()}${el.path.value.trim()}`;
}

function toRad(d) { return (d * Math.PI) / 180; }
function toDeg(r) { return (r * 180) / Math.PI; }

function bearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function setCurrentLocation(lat, lon, label = 'My location') {
  state.current = { lat, lon, label };
  el.currentLabel.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  if (!hasLeaflet) return;
  if (state.currentMarker) state.currentMarker.setLatLng([lat, lon]);
  else state.currentMarker = L.marker([lat, lon]).addTo(map).bindPopup('Current location');
}

function setDestination(lat, lon, name) {
  state.destination = { lat, lon, name };
  if (!hasLeaflet) return;
  if (state.destinationMarker) state.destinationMarker.setLatLng([lat, lon]);
  else state.destinationMarker = L.marker([lat, lon]).addTo(map).bindPopup('Destination');
}

function clearRouteView() {
  if (state.routeLine) {
    state.routeLine.remove();
    state.routeLine = null;
  }
  el.steps.innerHTML = '';
  el.distanceOut.textContent = '--';
  el.durationOut.textContent = '--';
  el.bearingOut.textContent = '--';
  el.payloadPreview.textContent = '{}';
  state.payload = null;
}

function decodeStep(step) {
  const road = step.name ? ` on ${step.name}` : '';
  return `${step.maneuver.instruction || step.maneuver.type}${road}`;
}

async function geocodeDestination(name) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Destination search failed');
  const data = await res.json();
  if (!data.length) throw new Error('Destination not found');
  return {
    lat: Number(data[0].lat),
    lon: Number(data[0].lon),
    displayName: data[0].display_name,
  };
}

async function fetchRoute(current, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${current.lon},${current.lat};${destination.lon},${destination.lat}?overview=full&steps=true&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Route API failed');
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) throw new Error('No route available');
  return route;
}

function renderRoute(route) {
  if (!hasLeaflet) return;
  if (state.routeLine) state.routeLine.remove();
  const latLngs = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  state.routeLine = L.polyline(latLngs, { color: '#38bdf8', weight: 4 }).addTo(map);
  map.fitBounds(state.routeLine.getBounds(), { padding: [20, 20] });
}

function renderSteps(route) {
  el.steps.innerHTML = '';
  const steps = route.legs?.[0]?.steps || [];
  steps.slice(0, 12).forEach((step) => {
    const li = document.createElement('li');
    li.textContent = decodeStep(step);
    el.steps.appendChild(li);
  });
}

function buildPayload(route) {
  const current = state.current;
  const destination = state.destination;
  const distanceKm = route.distance / 1000;
  const durationMin = route.duration / 60;
  const bearingDeg = bearing(current.lat, current.lon, destination.lat, destination.lon);

  el.distanceOut.textContent = `${distanceKm.toFixed(2)} km`;
  el.durationOut.textContent = `${durationMin.toFixed(1)} min`;
  el.bearingOut.textContent = `${bearingDeg.toFixed(1)}°`;

  const payload = {
    timestamp: new Date().toISOString(),
    provider: 'openstreetmap+osrm',
    current: { lat: current.lat, lon: current.lon },
    destination: { lat: destination.lat, lon: destination.lon, name: destination.name },
    nav: {
      distanceKm: Number(distanceKm.toFixed(2)),
      durationMin: Number(durationMin.toFixed(1)),
      bearingDeg: Number(bearingDeg.toFixed(1)),
    },
  };

  state.payload = payload;
  el.payloadPreview.textContent = JSON.stringify(payload, null, 2);
  return payload;
}

async function routeToDestinationName() {
  if (!state.current) throw new Error('Current location is not available yet');
  const query = el.destinationName.value.trim();
  if (!query) throw new Error('Enter destination name');

  const destination = await geocodeDestination(query);
  setDestination(destination.lat, destination.lon, destination.displayName);
  log(`Destination found: ${destination.displayName}`);

  const route = await fetchRoute(state.current, destination);
  renderRoute(route);
  renderSteps(route);
  buildPayload(route);
  log('Route generated');
}

async function sendPayload(payload) {
  const mode = el.protocol.value;
  const url = endpoint();

  if (mode === 'ws') {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) throw new Error('WebSocket not connected');
    state.socket.send(JSON.stringify(payload));
    log(`Sent via WebSocket to ${url}`);
    return;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP failed (${res.status})`);
  log(`Sent via HTTP to ${url}`);
}

function detectCurrentLocation() {
  if (!navigator.geolocation) {
    log('Geolocation not supported');
    el.currentLabel.value = 'Geolocation not supported';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      setCurrentLocation(coords.latitude, coords.longitude);
      if (hasLeaflet) map.setView([coords.latitude, coords.longitude], 14);
      log('Current location detected');
    },
    (error) => {
      el.currentLabel.value = 'Location permission denied / unavailable';
      log(`Geolocation error: ${error.message}`);
    },
    { enableHighAccuracy: true, timeout: 12000 }
  );
}

el.connectBtn.addEventListener('click', () => {
  if (el.protocol.value !== 'ws') {
    setConnected(false);
    log('HTTP mode selected, no persistent connection needed');
    return;
  }

  try {
    const url = endpoint();
    if (state.socket) state.socket.close();
    state.socket = new WebSocket(url);
    state.socket.addEventListener('open', () => { setConnected(true); log(`Connected to ${url}`); });
    state.socket.addEventListener('close', () => { setConnected(false); log('WebSocket closed'); });
    state.socket.addEventListener('error', () => { setConnected(false); log('WebSocket error'); });
    state.socket.addEventListener('message', (e) => log(`ESP32: ${e.data}`));
  } catch (error) {
    log(error.message);
  }
});

el.locateBtn.addEventListener('click', detectCurrentLocation);

el.routeBtn.addEventListener('click', async () => {
  try {
    await routeToDestinationName();
  } catch (error) {
    log(`Routing failed: ${error.message}`);
  }
});

el.clearBtn.addEventListener('click', () => {
  state.destination = null;
  if (state.destinationMarker) {
    state.destinationMarker.remove();
    state.destinationMarker = null;
  }
  clearRouteView();
  el.destinationName.value = '';
  log('Cleared destination and route');
});

el.sendBtn.addEventListener('click', async () => {
  try {
    const payload = state.payload;
    if (!payload) throw new Error('Generate route first');
    await sendPayload(payload);
  } catch (error) {
    log(`Send failed: ${error.message}`);
  }
});

detectCurrentLocation();
