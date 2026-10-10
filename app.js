const MAX_ZOOM = 11;
const MIN_ZOOM = 4;
const MAP_HEIGHT_MAX_ZOOM_PX = 364544;
const RS_TILE_PX = 32;
const RS_OFFSET_X = 960;
const RS_OFFSET_Y = 6208;

const params = new URLSearchParams(location.search);
let plane = clampPlane(Number(params.get('centreZ') ?? 0));
let first = null;
let second = null;
let hoverRect = null;
let selectionRect = null;
let selectionLabels = [];
let gridLayers = [];

const map = L.map('map', {
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  zoomControl: true,
  attributionControl: true,
  preferCanvas: true
});

map.attributionControl.addAttribution('KSP Maps');
map.attributionControl.addAttribution('Fallback imagery: Explv/osrs_map_tiles');

const planeSelect = document.querySelector('#plane');
const hoverEl = document.querySelector('#hover');
const regionEl = document.querySelector('#region');
const selectionEl = document.querySelector('#selection');
const copyWorldArea = document.querySelector('#copy-world-area');
planeSelect.value = String(plane);

let tileLayer = null;

function clampPlane(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(3, Math.trunc(value))) : 0;
}

function positionToLatLng(x, y) {
  const px = ((x - RS_OFFSET_X) * RS_TILE_PX) + (RS_TILE_PX / 4);
  const py = MAP_HEIGHT_MAX_ZOOM_PX - ((y - RS_OFFSET_Y) * RS_TILE_PX);
  return map.unproject(L.point(px, py), MAX_ZOOM);
}

function positionCentreToLatLng(x, y) {
  return positionToLatLng(x + 0.5, y + 0.5);
}

function latLngToPosition(latlng) {
  const point = map.project(latlng, MAX_ZOOM);
  let y = MAP_HEIGHT_MAX_ZOOM_PX - point.y + (RS_TILE_PX / 4);
  y = Math.round((y - RS_TILE_PX) / RS_TILE_PX) + RS_OFFSET_Y;
  const x = Math.round((point.x - RS_TILE_PX) / RS_TILE_PX) + RS_OFFSET_X;
  return { x, y, z: plane };
}

function regionInfo(p) {
  const regionX = p.x >> 6;
  const regionY = p.y >> 6;
  return {
    id: (regionX << 8) | regionY,
    x: p.x & 63,
    y: p.y & 63
  };
}

function tileBounds(p) {
  return L.latLngBounds(positionToLatLng(p.x, p.y), positionToLatLng(p.x + 1, p.y + 1));
}

function installTiles() {
  if (tileLayer) map.removeLayer(tileLayer);

  const kspTemplate = `https://raw.githubusercontent.com/KSPOG/kspmaps/main/tiles/${plane}/{z}/{x}/{y}.png`;
  tileLayer = L.tileLayer(kspTemplate, {
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    noWrap: true,
    tms: true,
    keepBuffer: 2
  });

  tileLayer.on('tileerror', event => {
    const image = event.tile;
    if (image.dataset.explvFallback === '1') return;
    image.dataset.explvFallback = '1';
    image.src = image.src.replace(
      'https://raw.githubusercontent.com/KSPOG/kspmaps/main/tiles/',
      'https://raw.githubusercontent.com/Explv/osrs_map_tiles/master/'
    );
  });

  tileLayer.addTo(map);
}

function clearGrid() {
  gridLayers.forEach(layer => map.removeLayer(layer));
  gridLayers = [];
}

function addGridLine(points, weight = 1, opacity = 0.22) {
  const line = L.polyline(points, {
    color: '#ffffff',
    weight,
    opacity,
    interactive: false
  }).addTo(map);
  gridLayers.push(line);
}

function updateGrid() {
  clearGrid();

  const zoom = map.getZoom();
  const bounds = map.getBounds();
  const nw = latLngToPosition(bounds.getNorthWest());
  const se = latLngToPosition(bounds.getSouthEast());

  const minX = Math.min(nw.x, se.x) - 2;
  const maxX = Math.max(nw.x, se.x) + 2;
  const minY = Math.min(nw.y, se.y) - 2;
  const maxY = Math.max(nw.y, se.y) + 2;

  // Avoid thousands of DOM/canvas objects when zoomed far out.
  const step = zoom >= 10 ? 1 : zoom >= 8 ? 8 : 64;
  const startX = Math.floor(minX / step) * step;
  const startY = Math.floor(minY / step) * step;

  for (let x = startX; x <= maxX; x += step) {
    const major = x % 64 === 0;
    addGridLine(
      [positionToLatLng(x, minY), positionToLatLng(x, maxY + 1)],
      major ? 2 : 1,
      major ? 0.45 : 0.18
    );
  }

  for (let y = startY; y <= maxY; y += step) {
    const major = y % 64 === 0;
    addGridLine(
      [positionToLatLng(minX, y), positionToLatLng(maxX + 1, y)],
      major ? 2 : 1,
      major ? 0.45 : 0.18
    );
  }
}

function setHover(p) {
  if (hoverRect) map.removeLayer(hoverRect);
  hoverRect = L.rectangle(tileBounds(p), {
    color: '#ffffff',
    weight: 1,
    fill: false,
    interactive: false
  }).addTo(map);

  const region = regionInfo(p);
  hoverEl.textContent = `(${p.x}, ${p.y}, ${p.z})`;
  regionEl.textContent = `${region.id}  local (${region.x}, ${region.y})`;
}

function removeSelectionVisuals() {
  if (selectionRect) map.removeLayer(selectionRect);
  selectionRect = null;
  selectionLabels.forEach(label => map.removeLayer(label));
  selectionLabels = [];
}

function updateSelection() {
  removeSelectionVisuals();

  if (!first) {
    selectionEl.textContent = 'Click two corner tiles';
    copyWorldArea.disabled = true;
    return;
  }

  if (!second) {
    selectionEl.textContent = `First corner (${first.x}, ${first.y}, ${first.z}) — select opposite corner`;
    copyWorldArea.disabled = true;
    return;
  }

  const minX = Math.min(first.x, second.x);
  const maxX = Math.max(first.x, second.x);
  const minY = Math.min(first.y, second.y);
  const maxY = Math.max(first.y, second.y);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  selectionRect = L.rectangle(
    L.latLngBounds(positionToLatLng(minX, minY), positionToLatLng(maxX + 1, maxY + 1)),
    { color: '#33b5e5', weight: 2, fillColor: '#33b5e5', fillOpacity: 0.22, interactive: false }
  ).addTo(map);

  selectionEl.textContent = `(${minX}, ${minY}) → (${maxX}, ${maxY}) | ${width} × ${height} | plane ${plane}`;
  copyWorldArea.disabled = false;
}

function selectPoint(p) {
  if (!first || second) {
    first = p;
    second = null;
  } else {
    second = p;
  }
  updateSelection();
}

function clearSelection() {
  first = null;
  second = null;
  updateSelection();
}

function centreOn(x, y, zoom = map.getZoom()) {
  map.setView(positionCentreToLatLng(x, y), Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(zoom) || 10)));
}

function updateUrl() {
  if (!map._loaded) return;
  const centre = latLngToPosition(map.getCenter());
  const query = new URLSearchParams({
    centreX: centre.x,
    centreY: centre.y,
    centreZ: plane,
    zoom: map.getZoom()
  });
  history.replaceState(null, '', `?${query}`);
}

map.on('mousemove', event => setHover(latLngToPosition(event.latlng)));
map.on('click', event => selectPoint(latLngToPosition(event.latlng)));
map.on('moveend zoomend', () => {
  updateGrid();
  updateUrl();
});

planeSelect.addEventListener('change', () => {
  plane = clampPlane(Number(planeSelect.value));
  clearSelection();
  installTiles();
  updateGrid();
  updateUrl();
});

document.querySelector('#goto').addEventListener('click', () => {
  const x = Number(document.querySelector('#goto-x').value);
  const y = Number(document.querySelector('#goto-y').value);
  if (Number.isFinite(x) && Number.isFinite(y)) centreOn(x, y);
});

document.querySelector('#clear').addEventListener('click', clearSelection);

copyWorldArea.addEventListener('click', async () => {
  if (!first || !second) return;
  const minX = Math.min(first.x, second.x);
  const minY = Math.min(first.y, second.y);
  const width = Math.abs(first.x - second.x) + 1;
  const height = Math.abs(first.y - second.y) + 1;
  const java = `new WorldArea(${minX}, ${minY}, ${width}, ${height}, ${plane})`;
  await navigator.clipboard.writeText(java);
  copyWorldArea.textContent = 'Copied';
  setTimeout(() => { copyWorldArea.textContent = 'Copy WorldArea'; }, 900);
});

installTiles();

const initialX = Number(params.get('centreX') ?? 2915);
const initialY = Number(params.get('centreY') ?? 3314);
const initialZoom = Number(params.get('zoom') ?? 7);
centreOn(initialX, initialY, initialZoom);
updateSelection();
