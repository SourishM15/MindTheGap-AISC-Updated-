import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { feature } from 'topojson-client';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  view: 'US' | 'state';
  onStateClick: (geo: any) => void;
  selectedState?: string;
}

// -----------------------------------------------------------------
// Approximate state Gini coefficients (Census Bureau, ACS 5-year)
// Higher = more unequal. Range roughly 0.42–0.52 across US states.
// -----------------------------------------------------------------
const STATE_GINI: Record<string, number> = {
  'Alabama': 0.473, 'Alaska': 0.428, 'Arizona': 0.469, 'Arkansas': 0.468,
  'California': 0.487, 'Colorado': 0.460, 'Connecticut': 0.498,
  'Delaware': 0.461, 'Florida': 0.488, 'Georgia': 0.477, 'Hawaii': 0.456,
  'Idaho': 0.447, 'Illinois': 0.478, 'Indiana': 0.449, 'Iowa': 0.444,
  'Kansas': 0.459, 'Kentucky': 0.469, 'Louisiana': 0.493, 'Maine': 0.449,
  'Maryland': 0.460, 'Massachusetts': 0.480, 'Michigan': 0.461,
  'Minnesota': 0.456, 'Mississippi': 0.480, 'Missouri': 0.469,
  'Montana': 0.453, 'Nebraska': 0.451, 'Nevada': 0.462,
  'New Hampshire': 0.434, 'New Jersey': 0.472, 'New Mexico': 0.478,
  'New York': 0.514, 'North Carolina': 0.470, 'North Dakota': 0.441,
  'Ohio': 0.460, 'Oklahoma': 0.472, 'Oregon': 0.464,
  'Pennsylvania': 0.469, 'Rhode Island': 0.461, 'South Carolina': 0.473,
  'South Dakota': 0.449, 'Tennessee': 0.474, 'Texas': 0.484,
  'Utah': 0.426, 'Vermont': 0.435, 'Virginia': 0.466,
  'Washington': 0.463, 'West Virginia': 0.455, 'Wisconsin': 0.449,
  'Wyoming': 0.430,
};

const GINI_MIN = 0.426;
const GINI_MAX = 0.514;

// Map a normalised 0–1 value to a colour on a teal→amber→red gradient
function inequalityColor(gini: number): string {
  const t = Math.max(0, Math.min(1, (gini - GINI_MIN) / (GINI_MAX - GINI_MIN)));
  // Low   = teal  #14b8a6
  // Mid   = amber #f59e0b
  // High  = red   #ef4444
  if (t < 0.5) {
    const s = t * 2;
    const r = Math.round(20  + s * (245 - 20));
    const g = Math.round(184 + s * (158 - 184));
    const b = Math.round(166 + s * (11  - 166));
    return `rgb(${r},${g},${b})`;
  } else {
    const s = (t - 0.5) * 2;
    const r = Math.round(245 + s * (239 - 245));
    const g = Math.round(158 + s * (68  - 158));
    const b = Math.round(11  + s * (68  - 11));
    return `rgb(${r},${g},${b})`;
  }
}

// -----------------------------------------------------------------
// Custom tooltip HTML
// -----------------------------------------------------------------
function stateTooltipHtml(name: string): string {
  const gini = STATE_GINI[name];
  const giniLabel = gini ? gini.toFixed(3) : 'N/A';
  let tier = '';
  if (gini) {
    const t = (gini - GINI_MIN) / (GINI_MAX - GINI_MIN);
    if (t < 0.25) tier = '🟢 Low';
    else if (t < 0.5) tier = '🟡 Moderate';
    else if (t < 0.75) tier = '🟠 High';
    else tier = '🔴 Very High';
  }
  return `
    <div style="
      font-family: 'Inter', sans-serif;
      min-width: 160px;
      padding: 10px 14px;
      border-radius: 8px;
      background: rgba(15,23,42,0.92);
      border: 1px solid rgba(255,255,255,0.12);
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      color: #f1f5f9;
    ">
      <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px; color: #e2e8f0;">${name}</div>
      <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Gini Coefficient</div>
      <div style="font-size: 18px; font-weight: 700; color: #f8fafc;">${giniLabel}</div>
      <div style="margin-top: 6px; font-size: 12px;">${tier} inequality</div>
    </div>`;
}

const Map: React.FC<MapProps> = ({ view, onStateClick, selectedState = 'United States' }) => {
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const insetControlRef = useRef<L.Control | null>(null);
  const legendControlRef = useRef<L.Control | null>(null);
  const zoomControlRef = useRef<L.Control.Zoom | null>(null);

  // ----------------------------------------------------------------
  // Initialise map (runs once)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (mapRef.current) return;

    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) return;

    const usaBounds = L.latLngBounds(L.latLng(24, -125), L.latLng(50, -66));

    const map = L.map('map-container', {
      maxBounds: usaBounds,
      maxBoundsViscosity: 1.0,
      minZoom: 3,
      maxZoom: 12,
      zoomControl: true,
      attributionControl: true,
    }).setView([38.5, -96], 4);

    zoomControlRef.current = map.zoomControl;

    // CartoDB Dark Matter — free, no API key, looks stunning
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }
    ).addTo(map);

    mapRef.current = map;
  }, []);

  // ----------------------------------------------------------------
  // Render / update state layers whenever selectedState changes
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Toggle interaction based on selection
    if (selectedState !== 'United States') {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      if (zoomControlRef.current) map.removeControl(zoomControlRef.current);
    } else {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      if (zoomControlRef.current) map.addControl(zoomControlRef.current);
    }

    // Remove stale layers
    if (geoJsonRef.current) { map.removeLayer(geoJsonRef.current); geoJsonRef.current = null; }
    if (insetControlRef.current) { map.removeControl(insetControlRef.current); insetControlRef.current = null; }
    if (legendControlRef.current) { map.removeControl(legendControlRef.current); legendControlRef.current = null; }

    fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => {
        const allStates = feature(data, data.objects.states);
        const statesArray = (allStates as any).features;

        const continental = {
          type: 'FeatureCollection' as const,
          features: statesArray.filter((f: any) => f.id !== 2 && f.id !== 15),
        };

        // ---- GeoJSON layer with choropleth + tooltips ----
        const geoJson = L.geoJSON(continental as any, {
          style: (f: any) => {
            const name: string = f?.properties?.name ?? '';
            const isSelected = name === selectedState && selectedState !== 'United States';
            const gini = STATE_GINI[name] ?? 0.47;
            const fill = isSelected ? '#38bdf8' : inequalityColor(gini);
            return {
              fillColor: fill,
              fillOpacity: isSelected ? 0.95 : 0.78,
              color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.18)',
              weight: isSelected ? 2.5 : 0.8,
            };
          },
          onEachFeature: (f: any, layer: L.Layer) => {
            const name: string = f?.properties?.name ?? '';

            // Tooltip
            (layer as L.Path).bindTooltip(stateTooltipHtml(name), {
              sticky: true,
              direction: 'top',
              offset: [0, -6],
              opacity: 1,
              className: 'mtg-tooltip',
            });

            layer.on('click', () => { if (view === 'US') onStateClick(f); });

            layer.on('mouseover', () => {
              const isSelected = name === selectedState && selectedState !== 'United States';
              if ((layer as any).setStyle) {
                (layer as any).setStyle({
                  fillOpacity: 1,
                  weight: isSelected ? 3 : 1.8,
                  color: 'rgba(255,255,255,0.7)',
                });
              }
              (layer as any).bringToFront?.();
            });

            layer.on('mouseout', () => {
              if (geoJsonRef.current) geoJsonRef.current.resetStyle(layer as any);
            });
          },
        }).addTo(map);

        geoJsonRef.current = geoJson;

        // ---- Alaska & Hawaii inset ----
        const alaska = statesArray.find((f: any) => f.id === 2);
        const hawaii = statesArray.find((f: any) => f.id === 15);

        if (alaska || hawaii) {
          const InsetControl = L.Control.extend({
            onAdd() {
              const wrap = L.DomUtil.create('div');
              wrap.style.cssText = 'display:flex;gap:8px;padding:8px;pointer-events:all';

              const makeBox = (feat: any, label: string) => {
                const gini = STATE_GINI[label] ?? 0.47;
                const isSelected = selectedState === label;
                const color = isSelected ? '#38bdf8' : inequalityColor(gini);
                const box = L.DomUtil.create('div', '', wrap) as HTMLDivElement;
                box.title = `${label} — Gini: ${gini.toFixed(3)}`;
                box.style.cssText = `
                  width:76px; height:54px;
                  background:${color};
                  border:${isSelected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.25)'};
                  border-radius:6px;
                  display:flex; align-items:center; justify-content:center;
                  font-size:11px; font-weight:700; color:#fff;
                  cursor:pointer; transition:all 0.2s ease;
                  text-shadow:0 1px 3px rgba(0,0,0,0.6);
                  box-shadow:${isSelected ? '0 0 12px rgba(56,189,248,0.6)' : '0 2px 8px rgba(0,0,0,0.4)'};
                `;
                box.textContent = label;
                L.DomEvent.on(box, 'mouseover', () => {
                  box.style.transform = 'scale(1.08)';
                  box.style.boxShadow = '0 4px 16px rgba(0,0,0,0.6)';
                });
                L.DomEvent.on(box, 'mouseout', () => {
                  box.style.transform = 'scale(1)';
                  box.style.boxShadow = isSelected
                    ? '0 0 12px rgba(56,189,248,0.6)'
                    : '0 2px 8px rgba(0,0,0,0.4)';
                });
                L.DomEvent.on(box, 'click', () =>
                  onStateClick({ type: 'Feature', properties: { name: label }, geometry: feat.geometry })
                );
              };

              if (alaska) makeBox(alaska, 'Alaska');
              if (hawaii) makeBox(hawaii, 'Hawaii');
              return wrap;
            },
          });

          const ctrl = new (InsetControl as any)({ position: 'bottomleft' });
          ctrl.addTo(map);
          insetControlRef.current = ctrl;
        }

        // ---- Legend ----
        const Legend = L.Control.extend({
          onAdd() {
            const div = L.DomUtil.create('div');
            div.style.cssText = `
              background:rgba(15,23,42,0.88);
              border:1px solid rgba(255,255,255,0.1);
              border-radius:8px;
              padding:10px 14px;
              font-family:'Inter',sans-serif;
              color:#e2e8f0;
              font-size:11px;
              min-width:150px;
              backdrop-filter:blur(8px);
              box-shadow:0 4px 20px rgba(0,0,0,0.4);
            `;
            const gradientId = 'mtg-gradient';
            div.innerHTML = `
              <div style="font-weight:700;font-size:12px;margin-bottom:8px;color:#f1f5f9;letter-spacing:0.04em">WEALTH INEQUALITY</div>
              <svg width="120" height="12" style="display:block;border-radius:4px;margin-bottom:4px">
                <defs>
                  <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%"   stop-color="#14b8a6"/>
                    <stop offset="50%"  stop-color="#f59e0b"/>
                    <stop offset="100%" stop-color="#ef4444"/>
                  </linearGradient>
                </defs>
                <rect width="120" height="12" fill="url(#${gradientId})" rx="3"/>
              </svg>
              <div style="display:flex;justify-content:space-between;color:#94a3b8;font-size:10px">
                <span>Lower</span><span>Gini index</span><span>Higher</span>
              </div>
              <div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.08);padding-top:6px;color:#94a3b8;font-size:10px">
                Selected state: <span style="color:#38bdf8;font-weight:600">sky blue</span>
              </div>
            `;
            return div;
          },
        });

        const legendCtrl = new (Legend as any)({ position: 'bottomright' });
        legendCtrl.addTo(map);
        legendControlRef.current = legendCtrl;

        // ---- Zoom to view ----
        if (selectedState !== 'United States') {
          const feat = statesArray.find((f: any) => f.properties.name === selectedState);
          if (feat) {
            const bounds = (L.geoJSON(feat) as any).getBounds();
            map.fitBounds(bounds, { padding: [50, 50], animate: true });
          }
        } else {
          map.fitBounds(L.latLngBounds(L.latLng(24, -125), L.latLng(50, -66)), {
            padding: [30, 30],
            animate: true,
          });
        }
      })
      .catch(err => console.error('Failed to load states:', err));
  }, [selectedState, view]);

  return (
    <>
      {/* Inject tooltip CSS once */}
      <style>{`
        .mtg-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        .mtg-tooltip .leaflet-tooltip-tip { display: none !important; }
        .leaflet-control-attribution { background: rgba(15,23,42,0.7) !important; color: #64748b !important; font-size: 10px !important; }
        .leaflet-control-attribution a { color: #94a3b8 !important; }
      `}</style>
      <div
        id="map-container"
        className="relative w-full h-[500px] rounded-xl overflow-hidden border border-slate-700/60"
        style={{ background: '#020817' }}
      />
    </>
  );
};

export default Map;

