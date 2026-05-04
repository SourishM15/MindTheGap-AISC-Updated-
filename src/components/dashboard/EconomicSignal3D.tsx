import React, { useMemo, useState } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { DashboardMetric3DPoint, VisualizationType } from '../../types/dashboard';

interface EconomicSignal3DProps {
  points: DashboardMetric3DPoint[];
  onDrillTo: (type: VisualizationType) => void;
}

interface SignalBarProps {
  point: DashboardMetric3DPoint;
  x: number;
  isHovered: boolean;
  onHover: (point: DashboardMetric3DPoint | null) => void;
  onDrillTo: (type: VisualizationType) => void;
}

const SignalBar: React.FC<SignalBarProps> = ({ point, x, isHovered, onHover, onDrillTo }) => {
  const radius = isHovered ? 0.34 : 0.3;

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHover(point);
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHover(null);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onDrillTo(point.targetView);
  };

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.04, 0]} rotation={[0, Math.PI / 6, 0]}>
        <cylinderGeometry args={[0.48, 0.58, 0.08, 6]} />
        <meshStandardMaterial color="#0f172a" roughness={0.45} metalness={0.15} emissive={point.color} emissiveIntensity={isHovered ? 0.1 : 0.04} />
      </mesh>
      <mesh
        position={[0, point.height / 2, 0]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        rotation={[0, Math.PI / 6, 0]}
      >
        <cylinderGeometry args={[radius, radius * 1.08, point.height, 6]} />
        <meshStandardMaterial color={point.color} roughness={0.42} metalness={0.18} emissive={point.color} emissiveIntensity={isHovered ? 0.22 : 0.08} />
      </mesh>

      <mesh position={[0, point.height + 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[isHovered ? 0.19 : 0.16, 0.025, 10, 28]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.35} emissive={point.color} emissiveIntensity={0.16} />
      </mesh>

      <mesh position={[0, point.height + 0.16, 0]}>
        <sphereGeometry args={[isHovered ? 0.1 : 0.075, 18, 18]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.35} emissive={point.color} emissiveIntensity={0.18} />
      </mesh>

      <Html position={[0, point.height + 0.48, 0]} center distanceFactor={9}>
        <div className="pointer-events-none whitespace-nowrap rounded-md border border-white/10 bg-slate-950/85 px-2 py-1 text-[10px] font-black text-white shadow-lg shadow-black/30">
          {point.formattedValue}
        </div>
      </Html>

      <Html position={[0, -0.14, 0.74]} center distanceFactor={9}>
        <div className="pointer-events-none max-w-[72px] text-center text-[9px] font-bold uppercase leading-tight text-slate-300">
          {point.axisLabel}
        </div>
      </Html>
    </group>
  );
};

const EconomicSignal3D: React.FC<EconomicSignal3DProps> = ({ points, onDrillTo }) => {
  const [hoveredPoint, setHoveredPoint] = useState<DashboardMetric3DPoint | null>(null);
  const visiblePoints = useMemo(() => points.slice(0, 6), [points]);

  if (!visiblePoints.length) {
    return null;
  }

  const spacing = 1.28;
  const startX = -((visiblePoints.length - 1) * spacing) / 2;

  return (
    <section className="mb-5 overflow-hidden rounded-lg border border-slate-200 bg-slate-950 text-white shadow-xl shadow-slate-300/30 dark:border-slate-800 dark:shadow-black/25">
      <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
        <div className="relative h-[390px] min-h-[390px]">
          <Canvas camera={{ position: [0, 3.65, 8.8], fov: 36 }} dpr={[1, 1.75]}>
            <color attach="background" args={['#020617']} />
            <fog attach="fog" args={['#020617', 8, 15]} />
            <ambientLight intensity={0.72} />
            <directionalLight position={[3, 5, 4]} intensity={1.4} />
            <pointLight position={[-3, 3, 2]} intensity={0.9} color="#22d3ee" />
            <pointLight position={[3, 2.6, 2]} intensity={0.55} color="#f59e0b" />

            <group position={[0, -0.48, 0]} rotation={[-0.05, 0, 0]} scale={0.9}>
              <gridHelper args={[7.8, 10, '#334155', '#1e293b']} position={[0, 0, 0]} />
              <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.35, 3.55, 80]} />
                <meshBasicMaterial color="#0e7490" transparent opacity={0.18} />
              </mesh>
              {visiblePoints.map((point, index) => (
                <SignalBar
                  key={point.id}
                  point={point}
                  x={startX + index * spacing}
                  isHovered={hoveredPoint?.id === point.id}
                  onHover={setHoveredPoint}
                  onDrillTo={onDrillTo}
                />
              ))}
            </group>

            <OrbitControls
              enablePan={false}
              enableZoom={false}
              minPolarAngle={0.86}
              maxPolarAngle={1.28}
              target={[0, 1.2, 0]}
            />
          </Canvas>
        </div>

        <aside className="border-t border-white/10 bg-slate-900/80 p-4 lg:border-l lg:border-t-0">
          <p className="text-xs font-black uppercase tracking-wide text-cyan-200">3D Economic Signal</p>
          <h3 className="mt-2 text-xl font-black tracking-tight text-white">
            {hoveredPoint?.label ?? 'Metric terrain'}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {hoveredPoint?.description ?? 'Hover a bar to inspect its source, year, and normalized signal strength. Click a bar to open the related dashboard view.'}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-md border border-white/10 bg-white/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Value</p>
              <p className="mt-1 text-lg font-black text-white">{hoveredPoint?.formattedValue ?? '-'}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Source</p>
              <p className="mt-1 text-lg font-black text-white">{hoveredPoint?.source ?? '-'}</p>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-white/10 bg-white/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Signal strength</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300"
                style={{ width: `${Math.round((hoveredPoint?.normalizedValue ?? 0) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-slate-400">
              Year: {hoveredPoint?.year ?? '-'}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default EconomicSignal3D;
