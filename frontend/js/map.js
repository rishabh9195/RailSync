let railMap, railMarkers = [];
function trainPoint(t, route) {
  if (!route || route.length < 2) return route && route[0] ? route[0] : [25.3, 83.2];
  const n = route.length - 1;
  const pos = Math.max(0, Math.min(n, Number(t.position) || 0));
  const a = Math.min(n - 1, Math.floor(pos));
  const f = pos - a;
  const p1 = route[a], p2 = route[Math.min(a + 1, n)];
  return [p1[0] + (p2[0] - p1[0]) * f, p1[1] + (p2[1] - p1[1]) * f];
}
function drawRailMap(id = 'map', multi = false, focusId = '12301') {
  let node = document.getElementById(id);
  if (!node || !window.L) return;
  // Use the selected train's own route instead of always using 12301.
  let focusTrain = null;
  try { focusTrain = RailETA.getTrain(focusId); } catch (e) { focusTrain = null; }
  const stations = RailETA.getStations((focusTrain && focusTrain.id) || focusId);
  const route = stations.map(s => s.coords);
  if (railMap) railMap.remove();
  const mid = route[Math.floor(route.length / 2)] || [25.3, 83.2];
  railMap = L.map(id, { zoomControl: false }).setView(mid, 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(railMap);
  L.polyline(route, { color: '#3975ff', weight: 4, opacity: .75 }).addTo(railMap);
  stations.forEach(s => L.circleMarker(s.coords, { radius: 7, color: '#fff', weight: 3, fillColor: '#3975ff', fillOpacity: 1 }).bindPopup(`<b>${s.name}</b><br>RailSync monitored station`).addTo(railMap));
  let trains = multi ? RailETA.getTrains() : [focusTrain || RailETA.getTrain(focusId)];
  railMarkers = trains.map(t => {
    let tRoute = route;
    if (multi) {
      try {
        const ts = RailETA.getStations(t.id).map(s => s.coords);
        if (ts && ts.length) tRoute = ts;
      } catch (e) { /* keep focused route */ }
    }
    return L.marker(trainPoint(t, tRoute), { icon: L.divIcon({ className: 'train-marker', html: '<div>🚆</div>' }) }).bindPopup(`<b>${t.id} ${t.name}</b><br>${t.location} · ${t.speed} km/h · +${t.predictedDelay} min`).addTo(railMap);
  });
  setTimeout(() => railMap.invalidateSize(), 120);
}
function focusTrainOnMap(id) {
  let t = RailETA.getTrain(id), route = RailETA.getStations((t && t.id) || id).map(s => s.coords), point = trainPoint(t, route);
  if (railMap) railMap.setView(point, 8, { animate: true, duration: .7 });
  window.open(`https://www.google.com/maps/search/?api=1&query=${point[0]},${point[1]}`, '_blank', 'noopener');
}
