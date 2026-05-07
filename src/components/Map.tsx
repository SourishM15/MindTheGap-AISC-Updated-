import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { feature } from 'topojson-client';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  view: 'US' | 'state';
  onStateClick: (geo: any) => void;
  selectedState?: string;
  stateData?: Record<string, { gini: number; poverty: number; income: number }>;
}

type Metric = 'gini' | 'poverty' | 'income';

// -----------------------------------------------------------------
// State data — Census ACS 2022 (Gini) + SAIPE 2023 (poverty/income)
// -----------------------------------------------------------------
export const STATE_DATA: Record<string, { gini: number; poverty: number; income: number }> = {
  'Alabama':        { gini: 0.473, poverty: 16.4, income: 54943 },
  'Alaska':         { gini: 0.428, poverty:  9.9, income: 83012 },
  'Arizona':        { gini: 0.469, poverty: 12.9, income: 68319 },
  'Arkansas':       { gini: 0.468, poverty: 15.7, income: 52228 },
  'California':     { gini: 0.487, poverty: 11.3, income: 84097 },
  'Colorado':       { gini: 0.460, poverty:  8.7, income: 87598 },
  'Connecticut':    { gini: 0.498, poverty:  9.1, income: 90213 },
  'Delaware':       { gini: 0.461, poverty: 10.1, income: 76684 },
  'Florida':        { gini: 0.488, poverty: 13.5, income: 67917 },
  'Georgia':        { gini: 0.477, poverty: 14.1, income: 71355 },
  'Hawaii':         { gini: 0.456, poverty:  9.3, income: 88005 },
  'Idaho':          { gini: 0.447, poverty: 10.2, income: 66474 },
  'Illinois':       { gini: 0.478, poverty: 11.0, income: 73759 },
  'Indiana':        { gini: 0.449, poverty: 11.8, income: 63002 },
  'Iowa':           { gini: 0.444, poverty:  9.7, income: 68816 },
  'Kansas':         { gini: 0.459, poverty: 10.9, income: 66962 },
  'Kentucky':       { gini: 0.469, poverty: 15.8, income: 57834 },
  'Louisiana':      { gini: 0.493, poverty: 18.6, income: 55891 },
  'Maine':          { gini: 0.449, poverty: 10.5, income: 68251 },
  'Maryland':       { gini: 0.460, poverty:  9.0, income: 98461 },
  'Massachusetts':  { gini: 0.480, poverty:  9.4, income: 96505 },
  'Michigan':       { gini: 0.461, poverty: 13.0, income: 67444 },
  'Minnesota':      { gini: 0.456, poverty:  8.9, income: 84313 },
  'Mississippi':    { gini: 0.480, poverty: 20.3, income: 50136 },
  'Missouri':       { gini: 0.469, poverty: 12.9, income: 63577 },
  'Montana':        { gini: 0.453, poverty: 12.4, income: 63249 },
  'Nebraska':       { gini: 0.451, poverty:  9.8, income: 72159 },
  'Nevada':         { gini: 0.462, poverty: 12.3, income: 69027 },
  'New Hampshire':  { gini: 0.434, poverty:  7.2, income: 90845 },
  'New Jersey':     { gini: 0.472, poverty:  9.4, income: 97126 },
  'New Mexico':     { gini: 0.478, poverty: 18.0, income: 55982 },
  'New York':       { gini: 0.514, poverty: 12.4, income: 78293 },
  'North Carolina': { gini: 0.470, poverty: 13.4, income: 65627 },
  'North Dakota':   { gini: 0.441, poverty:  9.9, income: 72827 },
  'Ohio':           { gini: 0.460, poverty: 12.6, income: 64781 },
  'Oklahoma':       { gini: 0.472, poverty: 15.2, income: 58116 },
  'Oregon':         { gini: 0.464, poverty: 11.5, income: 74746 },
  'Pennsylvania':   { gini: 0.469, poverty: 11.6, income: 72627 },
  'Rhode Island':   { gini: 0.461, poverty: 10.1, income: 74982 },
  'South Carolina': { gini: 0.473, poverty: 14.0, income: 63623 },
  'South Dakota':   { gini: 0.449, poverty: 11.1, income: 68817 },
  'Tennessee':      { gini: 0.474, poverty: 14.1, income: 63161 },
  'Texas':          { gini: 0.484, poverty: 14.2, income: 73035 },
  'Utah':           { gini: 0.426, poverty:  8.9, income: 86833 },
  'Vermont':        { gini: 0.435, poverty:  9.5, income: 78731 },
  'Virginia':       { gini: 0.466, poverty:  9.9, income: 87249 },
  'Washington':     { gini: 0.463, poverty: 10.2, income: 90325 },
  'West Virginia':  { gini: 0.455, poverty: 16.9, income: 55217 },
  'Wisconsin':      { gini: 0.449, poverty:  9.3, income: 72458 },
  'Wyoming':        { gini: 0.430, poverty:  9.9, income: 72495 },
};

export const METRIC_CONFIG: Record<Metric, { label: string; invert: boolean; format: (v: number) => string; min: number; max: number }> = {
  gini:    { label: 'Gini Index',     invert: false, format: v => v.toFixed(3),               min: 0.426, max: 0.514  },
  poverty: { label: 'Poverty Rate',   invert: false, format: v => `${v.toFixed(1)}%`,          min: 7.2,   max: 20.3   },
  income:  { label: 'Median Income',  invert: true,  format: v => `$${(v / 1000).toFixed(0)}k`, min: 50000, max: 98500  },
};

// Module-level TopoJSON cache — fetched once, shared across all re-renders
let _topoCache: any = null;
let _topoPromise: Promise<any> | null = null;

function fetchTopo(): Promise<any> {
  if (_topoCache) return Promise.resolve(_topoCache);
  if (_topoPromise) return _topoPromise;
  _topoPromise = fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(d => { _topoCache = d; _topoPromise = null; return d; });
  return _topoPromise;
}

// teal #14b8a6 → amber #f59e0b → red #ef4444
function metricColor(value: number, metric: Metric): string {
  const { min, max, invert } = METRIC_CONFIG[metric];
  let t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  if (invert) t = 1 - t;
  if (t < 0.5) {
    const s = t * 2;
    return `rgb(${Math.round(20 + s * 225)},${Math.round(184 - s * 26)},${Math.round(166 - s * 155)})`;
  } else {
    const s = (t - 0.5) * 2;
    return `rgb(${Math.round(245 - s * 6)},${Math.round(158 - s * 90)},${Math.round(11 + s * 57)})`;
  }
}

function inequalityTier(gini: number): string {
  const t = (gini - 0.426) / (0.514 - 0.426);
  if (t < 0.25) return '🟢 Low';
  if (t < 0.5)  return '🟡 Moderate';
  if (t < 0.75) return '🟠 High';
  return '🔴 Very High';
}

// Rich tooltip — always shows all three metrics regardless of active choropleth mode
function stateTooltipHtml(name: string, dataSource: Record<string, { gini: number; poverty: number; income: number }>): string {
  const d = dataSource[name];
  if (!d) return `<div style="padding:8px 12px;background:rgba(15,23,42,0.92);border-radius:8px;color:#f1f5f9;font-family:'Inter',sans-serif">${name}</div>`;
  return `
    <div style="font-family:'Inter',sans-serif;min-width:195px;padding:12px 16px;border-radius:10px;background:rgba(15,23,42,0.95);border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(8px);box-shadow:0 4px 24px rgba(0,0,0,0.55);color:#f1f5f9">
      <div style="font-weight:700;font-size:14px;margin-bottom:10px;color:#e2e8f0;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px">${name}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px">
        <div>
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em">Gini</div>
          <div style="font-size:17px;font-weight:700;color:#f8fafc">${d.gini.toFixed(3)}</div>
        </div>
        <div>
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em">Poverty</div>
          <div style="font-size:17px;font-weight:700;color:#f8fafc">${d.poverty.toFixed(1)}%</div>
        </div>
        <div>
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px">Median Income</div>
          <div style="font-size:17px;font-weight:700;color:#f8fafc">$${(d.income / 1000).toFixed(0)}k</div>
        </div>
        <div>
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px">Inequality</div>
          <div style="font-size:12px;font-weight:600;margin-top:4px">${inequalityTier(d.gini)}</div>
        </div>
      </div>
    </div>`;
}

const Map: React.FC<MapProps> = ({ view, onStateClick, selectedState = 'United States', stateData = STATE_DATA }) => {
  const mapRef          = useRef<L.Map | null>(null);
  const geoJsonRef      = useRef<L.GeoJSON | null>(null);
  const insetControlRef = useRef<L.Control | null>(null);
  const legendControlRef= useRef<L.Control | null>(null);
  const zoomControlRef  = useRef<L.Control.Zoom | null>(null);

  const [metric, setMetric] = useState<Metric>('gini');

  // ----------------------------------------------------------------
  // Initialise map once
  // ----------------------------------------------------------------
  useEffect(() => {
    if (mapRef.current) return;
    const container = document.getElementById('map-container');
    if (!container) return;

    const usaBounds = L.latLngBounds(L.latLng(24, -125), L.latLng(50, -66));
    const map = L.map('map-container', {
      maxBounds: usaBounds,
      maxBoundsViscosity: 1.0,
      minZoom: 3, maxZoom: 12,
      zoomControl: true,
      attributionControl: true,
    }).setView([38.5, -96], 4);

    zoomControlRef.current = map.zoomControl;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    mapRef.current = map;
  }, []);

  // ----------------------------------------------------------------
  // Re-render GeoJSON whenever metric or selectedState changes
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (selectedState !== 'United States') {
      map.dragging.disable(); map.scrollWheelZoom.disable();
      map.touchZoom.disable(); map.doubleClickZoom.disable();
      if (zoomControlRef.current) map.removeControl(zoomControlRef.current);
    } else {
      map.dragging.enable(); map.scrollWheelZoom.enable();
      map.touchZoom.enable(); map.doubleClickZoom.enable();
      if (zoomControlRef.current) map.addControl(zoomControlRef.current);
    }

    if (geoJsonRef.current)      { map.removeLayer(geoJsonRef.current);       geoJsonRef.current = null; }
    if (insetControlRef.current) { map.removeControl(insetControlRef.current); insetControlRef.current = null; }
    if (legendControlRef.current){ map.removeControl(legendControlRef.current); legendControlRef.current = null; }

    const getColor = (name: string, isSelected: boolean) => {
      if (isSelected) return '#38bdf8';
      const d = stateData[name];
      if (!d) return '#475569';
      const val = metric === 'gini' ? d.gini : metric === 'poverty' ? d.poverty : d.income;
      return metricColor(val, metric);
    };

    fetchTopo().then(data => {
      const allStates   = feature(data, data.objects.states);
      const statesArray = (allStates as any).features;
      const continental = {
        type: 'FeatureCollection' as const,
        features: statesArray.filter((f: any) => f.id !== 2 && f.id !== 15),
      };

      const geoJson = L.geoJSON(continental as any, {
        style: (f: any) => {
          const name = f?.properties?.name ?? '';
          const isSelected = name === selectedState && selectedState !== 'United States';
          return {
            fillColor: getColor(name, isSelected),
            fillOpacity: isSelected ? 0.95 : 0.8,
            color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.18)',
            weight: isSelected ? 2.5 : 0.8,
          };
        },
        onEachFeature: (f: any, layer: L.Layer) => {
          const name = f?.properties?.name ?? '';
          (layer as L.Path).bindTooltip(stateTooltipHtml(name, stateData), {
            sticky: true, direction: 'top', offset: [0, -6], opacity: 1, className: 'mtg-tooltip',
          });
          layer.on('click', () => { if (view === 'US') onStateClick(f); });
          layer.on('mouseover', () => {
            const isSel = name === selectedState && selectedState !== 'United States';
            if ((layer as any).setStyle) {
              (layer as any).setStyle({ fillOpacity: 1, weight: isSel ? 3 : 1.8, color: 'rgba(255,255,255,0.7)' });
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
      const hawaii  = statesArray.find((f: any) => f.id === 15);
      if (alaska || hawaii) {
        const InsetControl = L.Control.extend({
          onAdd() {
            const wrap = L.DomUtil.create('div');
            wrap.style.cssText = 'display:flex;gap:8px;padding:8px;pointer-events:all';
            const makeBox = (feat: any, label: string) => {
              const d = stateData[label];
              const isSelected = selectedState === label;
              const val = d ? (metric === 'gini' ? d.gini : metric === 'poverty' ? d.poverty : d.income) : 0;
              const color = isSelected ? '#38bdf8' : (d ? metricColor(val, metric) : '#475569');
              const box = L.DomUtil.create('div', '', wrap) as HTMLDivElement;
              box.style.cssText = `width:76px;height:54px;background:${color};border:${isSelected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.25)'};border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;cursor:pointer;transition:all 0.2s;text-shadow:0 1px 3px rgba(0,0,0,0.6);box-shadow:${isSelected ? '0 0 12px rgba(56,189,248,0.6)' : '0 2px 8px rgba(0,0,0,0.4)'};`;
              box.textContent = label;
              L.DomEvent.on(box, 'mouseover', () => { box.style.transform = 'scale(1.08)'; box.style.boxShadow = '0 4px 16px rgba(0,0,0,0.6)'; });
              L.DomEvent.on(box, 'mouseout',  () => { box.style.transform = 'scale(1)'; box.style.boxShadow = isSelected ? '0 0 12px rgba(56,189,248,0.6)' : '0 2px 8px rgba(0,0,0,0.4)'; });
              L.DomEvent.on(box, 'click', () => onStateClick({ type: 'Feature', properties: { name: label }, geometry: feat.geometry }));
            };
            if (alaska) makeBox(alaska, 'Alaska');
            if (hawaii)  makeBox(hawaii,  'Hawaii');
            return wrap;
          },
        });
        const ctrl = new (InsetControl as any)({ position: 'bottomleft' });
        ctrl.addTo(map);
        insetControlRef.current = ctrl;
      }

      // ---- Dynamic legend ----
      const cfg = METRIC_CONFIG[metric];
      const Legend = L.Control.extend({
        onAdd() {
          const div = L.DomUtil.create('div');
          div.style.cssText = 'background:rgba(15,23,42,0.88);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;font-family:\'Inter\',sans-serif;color:#e2e8f0;font-size:11px;min-width:155px;backdrop-filter:blur(8px);box-shadow:0 4px 20px rgba(0,0,0,0.4);';
          const [lowLabel, highLabel] = cfg.invert
            ? ['Higher', 'Lower']
            : ['Lower',  'Higher'];
          const title = L.DomUtil.create('div', '', div);
          title.style.cssText = 'font-weight:700;font-size:12px;margin-bottom:8px;color:#f1f5f9;letter-spacing:0.04em';
          title.textContent = cfg.label.toUpperCase();

          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('width', '125');
          svg.setAttribute('height', '12');
          svg.style.cssText = 'display:block;border-radius:4px;margin-bottom:4px';
          const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
          gradient.setAttribute('id', 'mtg-grad');
          gradient.setAttribute('x1', '0%');
          gradient.setAttribute('y1', '0%');
          gradient.setAttribute('x2', '100%');
          gradient.setAttribute('y2', '0%');
          [
            ['0%', '#14b8a6'],
            ['50%', '#f59e0b'],
            ['100%', '#ef4444'],
          ].forEach(([offset, color]) => {
            const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop.setAttribute('offset', offset);
            stop.setAttribute('stop-color', color);
            gradient.appendChild(stop);
          });
          defs.appendChild(gradient);
          svg.appendChild(defs);
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('width', '125');
          rect.setAttribute('height', '12');
          rect.setAttribute('fill', 'url(#mtg-grad)');
          rect.setAttribute('rx', '3');
          svg.appendChild(rect);
          div.appendChild(svg);

          const labels = L.DomUtil.create('div', '', div);
          labels.style.cssText = 'display:flex;justify-content:space-between;color:#94a3b8;font-size:10px';
          const low = L.DomUtil.create('span', '', labels);
          low.textContent = lowLabel;
          const high = L.DomUtil.create('span', '', labels);
          high.textContent = highLabel;

          const selected = L.DomUtil.create('div', '', div);
          selected.style.cssText = 'margin-top:8px;border-top:1px solid rgba(255,255,255,0.08);padding-top:6px;color:#94a3b8;font-size:10px';
          selected.append('Selected: ');
          const selectedColor = L.DomUtil.create('span', '', selected);
          selectedColor.style.cssText = 'color:#38bdf8;font-weight:600';
          selectedColor.textContent = 'sky blue';
          return div;
        },
      });
      const legendCtrl = new (Legend as any)({ position: 'bottomright' });
      legendCtrl.addTo(map);
      legendControlRef.current = legendCtrl;

      // ---- Fit bounds ----
      if (selectedState !== 'United States') {
        const feat = statesArray.find((f: any) => f.properties.name === selectedState);
        if (feat) map.fitBounds((L.geoJSON(feat) as any).getBounds(), { padding: [50, 50], animate: true });
      } else {
        map.fitBounds(L.latLngBounds(L.latLng(24, -125), L.latLng(50, -66)), { padding: [30, 30], animate: true });
      }
    }).catch(err => console.error('Failed to load map data:', err));
  }, [selectedState, view, metric, stateData]);

  return (
    <>
      <style>{`
        .mtg-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        .mtg-tooltip .leaflet-tooltip-tip { display: none !important; }
        .leaflet-control-attribution { background: rgba(15,23,42,0.7) !important; color: #64748b !important; font-size: 10px !important; }
        .leaflet-control-attribution a { color: #94a3b8 !important; }
      `}</style>

      <div className="relative">
        {/* Metric selector — floating pill bar centred over the map */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex gap-1 bg-slate-900/90 backdrop-blur border border-slate-700/60 rounded-full px-2 py-1.5 shadow-xl">
          {(['gini', 'poverty', 'income'] as Metric[]).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                metric === m
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
              }`}
            >
              {METRIC_CONFIG[m].label}
            </button>
          ))}
        </div>

        <div
          id="map-container"
          className="w-full h-[560px] rounded-xl overflow-hidden border border-slate-700/60"
          style={{ background: '#020817' }}
        />
      </div>
    </>
  );
};

export default Map;
