import React from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps';
import { useSpring, animated } from 'react-spring';
import { useNavigate } from 'react-router-dom';

const usStatesUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
const usCountiesUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json';

interface MapProps {
  view: 'US' | 'WA';
  onStateClick: (geo: any) => void;
}

const Map: React.FC<MapProps> = ({ view, onStateClick }) => {
  const navigate = useNavigate();
  const { transform, opacity } = useSpring({
    transform: view === 'WA' ? 'scale(8) translate(-135, -70)' : 'scale(1) translate(0, 0)',
    opacity: view === 'WA' ? 1 : 0,
    config: { mass: 1, tension: 170, friction: 26 },
  });

  const handleCountyClick = (geo: any) => {
    const countyName = geo.properties.name;
    if (countyName === 'King') {
      navigate(`/seattle-neighborhoods`);
    } else {
      const searchUrl = `https://www.google.com/search?q=most+prominent+neighborhoods+and+cities+in+${countyName}+County%2C+Washington`;
      window.open(searchUrl, '_blank');
    }
  };

  return (
    <div className="relative w-full h-[500px] bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{
          scale: 800,
        }}
        width={800}
        height={500}
      >
        <animated.g transform={transform}>
          <Geographies geography={usStatesUrl}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={() => view === 'US' && onStateClick(geo)}
                  style={{
                    default: {
                      fill: geo.properties.name === 'Washington' ? '#10B981' : '#4F46E5',
                      outline: 'none',
                      stroke: '#FFF',
                      strokeWidth: 0.5,
                      pointerEvents: view === 'WA' ? 'none' : 'auto',
                    },
                    hover: {
                      fill: geo.properties.name === 'Washington' ? '#34D399' : '#6366F1',
                      outline: 'none',
                      cursor: 'pointer',
                    },
                    pressed: {
                      fill: '#312E81',
                      outline: 'none',
                    },
                  }}
                />
              ))
            }
          </Geographies>
          <animated.g style={{ opacity }}>
            <Geographies geography={usCountiesUrl}>
              {({ geographies }) =>
                geographies
                  .filter(geo => geo.id.startsWith('53')) // Washington counties
                  .map(geo => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => view === 'WA' && handleCountyClick(geo)}
                      style={{
                        default: {
                          fill: 'transparent',
                          stroke: '#FFF',
                          strokeWidth: 0.2,
                          outline: 'none',
                          pointerEvents: view === 'WA' ? 'auto' : 'none',
                        },
                        hover: {
                          fill: 'rgba(255,255,255,0.2)',
                          stroke: '#FFF',
                          strokeWidth: 0.4,
                          outline: 'none',
                          cursor: 'pointer',
                        },
                        pressed: {
                          fill: 'rgba(255,255,255,0.4)',
                          stroke: '#FFF',
                          strokeWidth: 0.4,
                          outline: 'none',
                        },
                      }}
                    />
                  ))
              }
            </Geographies>
          </animated.g>
          <Marker coordinates={[-122.3321, 47.6062]}>
            <circle r={view === 'WA' ? 0.5 : 1} fill="#FF5722" stroke="#fff" strokeWidth={view === 'WA' ? 0.2 : 0.5} />
          </Marker>
        </animated.g>
      </ComposableMap>
    </div>
  );
};

export default Map;
