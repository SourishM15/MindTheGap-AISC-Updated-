import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { feature } from 'topojson-client';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  view: 'US' | 'state';
  onStateClick: (geo: any) => void;
  selectedState?: string;
}

const Map: React.FC<MapProps> = ({ view, onStateClick, selectedState = 'United States' }) => {
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const zoomControlRef = useRef<L.Control.Zoom | null>(null);

  const stateColors: { [key: string]: string } = {
    selected: '#10B981',
    unselected: '#4F46E5',
  };

  // Create inverted mask to black out areas outside USA
  const createMask = () => {
    // Large world polygon with inverted hole for USA
    const world = [
      [-90, -180],
      [-90, 180],
      [90, 180],
      [90, -180],
      [-90, -180],
    ];

    const usaBounds = [
      [24, -125],
      [24, -66],
      [50, -66],
      [50, -125],
      [24, -125],
    ];

    return {
      type: 'Polygon' as const,
      coordinates: [world, usaBounds],
    };
  };

  // Initialize map
  useEffect(() => {
    if (mapRef.current) return; // Already initialized

    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) {
      console.error('Map container not found with ID: map-container');
      return;
    }

    // USA bounding box: [south, west, north, east]
    const usaBounds = L.latLngBounds(
      L.latLng(24, -125),  // Southwest corner (south, west)
      L.latLng(50, -66)    // Northeast corner (north, east)
    );

    const map = L.map('map-container', {
      maxBounds: usaBounds,
      maxBoundsViscosity: 1.0, // Prevent dragging outside bounds
      minZoom: 3,
      maxZoom: 12,
      zoomControl: true, // Enable zoom control by default
    }).setView([37.5, -96], 4);

    // Store zoom control reference
    zoomControlRef.current = map.zoomControl;

    // Add black background
    L.rectangle(
      [[-90, -180], [90, 180]],
      { color: 'black', weight: 0, fillColor: 'black', fillOpacity: 1 }
    ).addTo(map);

    // Add inverted mask to black out non-USA areas
    L.geoJSON(createMask() as any, {
      style: {
        color: 'black',
        weight: 0,
        fillColor: 'black',
        fillOpacity: 1,
      },
    }).addTo(map);

    // Add tile layer (this will render on top of the black background within bounds)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 12,
    }).addTo(map);

    mapRef.current = map;
  }, []);

  // Load and render GeoJSON
  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const map = mapRef.current;

    // Disable dragging and zooming when a state is selected
    if (selectedState !== 'United States') {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      // Remove zoom control buttons
      if (zoomControlRef.current) {
        map.removeControl(zoomControlRef.current);
      }
    } else {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      // Re-add zoom control buttons
      if (zoomControlRef.current) {
        map.addControl(zoomControlRef.current);
      }
    }

    // Remove old GeoJSON layer
    if (geoJsonRef.current) {
      map.removeLayer(geoJsonRef.current);
    }

    // Fetch and display states
    fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        return res.json();
      })
      .then(data => {
        // Convert TopoJSON to GeoJSON
        const allStates = feature(data, data.objects.states);
        const statesArray = (allStates as any).features;

        // Filter out Alaska (2) and Hawaii (15) for main map
        const continentalStates = {
          type: 'FeatureCollection' as const,
          features: statesArray.filter((f: any) => {
            const id = f.id;
            return id !== 2 && id !== 15; // 2=Alaska, 15=Hawaii per US atlas
          }),
        };

        const geoJson = L.geoJSON(continentalStates as any, {
          style: (feature: any) => {
            const isSelected =
              feature?.properties?.name === selectedState && selectedState !== 'United States';
            return {
              fillColor: isSelected ? stateColors.selected : stateColors.unselected,
              weight: 1.5,
              opacity: 1,
              color: '#fff',
              fillOpacity: 0.85,
            };
          },
          onEachFeature: (feature: any, layer: L.Layer) => {
            layer.on('click', () => {
              if (view === 'US') {
                onStateClick(feature);
              }
            });
            layer.on('mouseover', () => {
              if ((layer as any).setStyle) {
                (layer as any).setStyle({ fillOpacity: 1 });
              }
            });
            layer.on('mouseout', () => {
              if ((layer as any).setStyle) {
                (layer as any).setStyle({ fillOpacity: 0.85 });
              }
            });
          },
        }).addTo(map);

        geoJsonRef.current = geoJson;

        // Get Alaska and Hawaii features for inset boxes
        const alaska = statesArray.find((f: any) => f.id === 2);
        const hawaii = statesArray.find((f: any) => f.id === 15);

        // Create inset boxes for Alaska and Hawaii using Leaflet control
        if (alaska || hawaii) {
          const InsetControl = L.Control.extend({
            onAdd: (_map: L.Map) => {
              const container = L.DomUtil.create('div', 'inset-control');
              container.style.display = 'flex';
              container.style.gap = '10px';
              container.style.padding = '10px';
              container.style.backgroundColor = 'transparent';

              const createInsetBox = (feature: any, name: string) => {
                const box = L.DomUtil.create('div', '', container) as HTMLDivElement;
                const isSelected = selectedState === name;
                box.style.width = '80px';
                box.style.height = '60px';
                box.style.border = '2px solid #333';
                box.style.backgroundColor = isSelected ? stateColors.selected : stateColors.unselected;
                box.style.borderRadius = '4px';
                box.style.display = 'flex';
                box.style.alignItems = 'center';
                box.style.justifyContent = 'center';
                box.style.fontSize = '11px';
                box.style.fontWeight = 'bold';
                box.style.color = '#fff';
                box.style.cursor = 'pointer';
                box.style.transition = 'all 0.2s ease';
                box.textContent = name;

                L.DomEvent.on(box, 'mouseover', () => {
                  box.style.opacity = '0.9';
                  box.style.transform = 'scale(1.05)';
                });
                L.DomEvent.on(box, 'mouseout', () => {
                  box.style.opacity = '1';
                  box.style.transform = 'scale(1)';
                });
                L.DomEvent.on(box, 'click', () => {
                  onStateClick({
                    type: 'Feature',
                    properties: { name },
                    geometry: feature.geometry,
                  });
                });

                return box;
              };

              if (alaska) {
                createInsetBox(alaska, 'Alaska');
              }
              if (hawaii) {
                createInsetBox(hawaii, 'Hawaii');
              }

              return container;
            },
          });

          new InsetControl({ position: 'bottomleft' }).addTo(map);
        }

        // Zoom to selected state or zoom out to USA view
        if (selectedState !== 'United States') {
          const selectedFeature = statesArray.find(
            (f: any) => f.properties.name === selectedState
          );
          if (selectedFeature) {
            const bounds = (L.geoJSON(selectedFeature) as any).getBounds();
            map.fitBounds(bounds, { padding: [50, 50], animate: true });
          } else {
            console.warn('Selected state not found in GeoJSON:', selectedState);
          }
        } else {
          // Zoom out to USA view with smooth animation
          const usaBounds = L.latLngBounds(
            L.latLng(24, -125),
            L.latLng(50, -66)
          );
          map.fitBounds(usaBounds, { padding: [50, 50], animate: true });
        }
      })
      .catch(err => console.error('Failed to load states:', err));
  }, [selectedState, view]);

  return (
    <div
      id="map-container"
      className="relative w-full h-[500px] bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
      style={{ background: '#1e293b' }}
    />
  );
};

export default Map;
