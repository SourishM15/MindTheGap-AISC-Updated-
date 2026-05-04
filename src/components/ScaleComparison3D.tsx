import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { Scale } from 'lucide-react';
import { SCALE_METRICS, ScaleMetricKey, ScaleStateMetrics } from './scaleComparisonConfig';

interface ScaleComparison3DProps {
  left?: ScaleStateMetrics;
  right?: ScaleStateMetrics;
  metricKey: ScaleMetricKey;
  compareMode: 'states' | 'us';
}

const getMetricValue = (metrics: ScaleStateMetrics | undefined, key: ScaleMetricKey) => {
  if (!metrics) return undefined;
  return metrics[key];
};

interface JusticeScaleSceneProps {
  leftLabel: string;
  rightLabel: string;
  leftValueLabel: string;
  rightValueLabel: string;
  tilt: number;
  leftNorm: number;
  rightNorm: number;
}

const GOLD = '#facc15';
const GOLD_DARK = '#92400e';
const CYAN = '#22d3ee';
const AMBER = '#f59e0b';

const Chain: React.FC<{ x: number; topY: number; panY: number; z: number }> = ({ x, topY, panY, z }) => {
  const length = Math.max(0.2, topY - panY);
  return (
    <mesh position={[x, panY + length / 2, z]}>
      <cylinderGeometry args={[0.012, 0.012, length, 8]} />
      <meshStandardMaterial color="#fde68a" roughness={0.35} metalness={0.45} />
    </mesh>
  );
};

const Pan: React.FC<{
  x: number;
  y: number;
  label: string;
  valueLabel: string;
  color: string;
  weight: number;
}> = ({ x, y, label, valueLabel, color, weight }) => (
  <group position={[x, y, 0]}>
    <mesh position={[0, 0.06, 0]}>
      <cylinderGeometry args={[0.66, 0.8, 0.16, 48]} />
      <meshStandardMaterial color="#d97706" roughness={0.36} metalness={0.42} emissive={color} emissiveIntensity={0.07 + weight * 0.08} />
    </mesh>
    <mesh position={[0, 0.16, 0]}>
      <torusGeometry args={[0.73, 0.035, 12, 48]} />
      <meshStandardMaterial color="#fef3c7" roughness={0.3} metalness={0.55} />
    </mesh>
    <mesh position={[0, 0.26 + weight * 0.28, 0]}>
      <sphereGeometry args={[0.16 + weight * 0.12, 24, 24]} />
      <meshStandardMaterial color={color} roughness={0.32} metalness={0.22} emissive={color} emissiveIntensity={0.18} />
    </mesh>
    <Html position={[0, 0.82, 0]} center distanceFactor={7}>
      <div className="pointer-events-none min-w-[118px] rounded-md border border-white/10 bg-slate-950/85 px-2 py-1 text-center shadow-lg shadow-black/30">
        <p className="truncate text-[10px] font-black uppercase tracking-wide text-cyan-100">{label}</p>
        <p className="text-sm font-black text-white">{valueLabel}</p>
      </div>
    </Html>
  </group>
);

const JusticeScaleScene: React.FC<JusticeScaleSceneProps> = ({
  leftLabel,
  rightLabel,
  leftValueLabel,
  rightValueLabel,
  tilt,
  leftNorm,
  rightNorm,
}) => {
  const tiltRad = (tilt * Math.PI) / 180;
  const beamY = 2.65;
  const leftX = -2.55;
  const rightX = 2.55;
  const leftEndY = beamY + Math.sin(tiltRad) * leftX;
  const rightEndY = beamY + Math.sin(tiltRad) * rightX;
  const leftPanY = leftEndY - 1.2 - leftNorm * 0.28;
  const rightPanY = rightEndY - 1.2 - rightNorm * 0.28;

  return (
    <Canvas camera={{ position: [0, 3.15, 8.8], fov: 36 }} dpr={[1, 1.75]}>
      <color attach="background" args={['#020617']} />
      <fog attach="fog" args={['#020617', 8, 15]} />
      <ambientLight intensity={0.68} />
      <directionalLight position={[3.5, 5.5, 4]} intensity={1.45} />
      <pointLight position={[-3, 3, 2]} intensity={0.8} color={CYAN} />
      <pointLight position={[3, 3, 2]} intensity={0.65} color={AMBER} />

      <group position={[0, -0.25, 0]} rotation={[-0.03, 0, 0]} scale={0.92}>
        <gridHelper args={[8.5, 12, '#334155', '#1e293b']} position={[0, 0, 0]} />

        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[1.18, 1.38, 0.16, 56]} />
          <meshStandardMaterial color={GOLD_DARK} roughness={0.34} metalness={0.38} />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.82, 1.04, 0.2, 56]} />
          <meshStandardMaterial color="#d97706" roughness={0.32} metalness={0.45} />
        </mesh>
        <mesh position={[0, 1.44, 0]}>
          <cylinderGeometry args={[0.08, 0.12, 2.42, 32]} />
          <meshStandardMaterial color={GOLD} roughness={0.28} metalness={0.55} emissive={GOLD} emissiveIntensity={0.08} />
        </mesh>
        <mesh position={[0, 2.78, 0]}>
          <sphereGeometry args={[0.22, 32, 32]} />
          <meshStandardMaterial color="#fef3c7" roughness={0.25} metalness={0.65} emissive={GOLD} emissiveIntensity={0.12} />
        </mesh>

        <group position={[0, beamY, 0]} rotation={[0, 0, tiltRad]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.055, 0.075, 5.45, 32]} />
            <meshStandardMaterial color={GOLD} roughness={0.27} metalness={0.6} emissive={GOLD} emissiveIntensity={0.09} />
          </mesh>
          <mesh position={[-2.55, 0, 0]}>
            <sphereGeometry args={[0.12, 20, 20]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.25} metalness={0.58} />
          </mesh>
          <mesh position={[2.55, 0, 0]}>
            <sphereGeometry args={[0.12, 20, 20]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.25} metalness={0.58} />
          </mesh>
        </group>

        {[-0.28, 0, 0.28].map((z) => (
          <React.Fragment key={`left-chain-${z}`}>
            <Chain x={leftX + z * 0.32} topY={leftEndY} panY={leftPanY + 0.18} z={z} />
            <Chain x={rightX + z * 0.32} topY={rightEndY} panY={rightPanY + 0.18} z={z} />
          </React.Fragment>
        ))}

        <Pan x={leftX} y={leftPanY} label={leftLabel} valueLabel={leftValueLabel} color={CYAN} weight={leftNorm} />
        <Pan x={rightX} y={rightPanY} label={rightLabel} valueLabel={rightValueLabel} color={AMBER} weight={rightNorm} />
      </group>

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={0.86}
        maxPolarAngle={1.32}
        target={[0, 1.35, 0]}
      />
    </Canvas>
  );
};

const ScaleComparison3D: React.FC<ScaleComparison3DProps> = ({ left, right, metricKey, compareMode }) => {
  const metric = SCALE_METRICS.find((item) => item.key === metricKey) ?? SCALE_METRICS[0];
  const leftValue = getMetricValue(left, metric.key);
  const rightValue = getMetricValue(right, metric.key);
  const leftNorm = metric.normalize(leftValue);
  const rightNorm = metric.normalize(rightValue);
  const rawTilt = (leftNorm - rightNorm) * 18;
  const tilt = Math.max(-10, Math.min(10, rawTilt));
  const diff = leftValue != null && rightValue != null ? leftValue - rightValue : null;
  const diffPercent = diff != null && rightValue ? (diff / rightValue) * 100 : null;
  const leader = leftNorm === rightNorm ? null : leftNorm > rightNorm ? left : right;
  const leaderValue = leftNorm > rightNorm ? leftValue : rightValue;
  const betterSide =
    leftValue == null || rightValue == null
      ? null
      : metric.higherIsBetter
        ? (leftValue >= rightValue ? left : right)
        : (leftValue <= rightValue ? left : right);

  const Icon = metric.icon;

  return (
    <section className="scale-panel">
      <div className="scale-panel-header">
        <div>
          <p className="scale-kicker">
            <Scale size={14} />
            Justice Scale View
          </p>
          <h4 className="mt-2 text-2xl font-black tracking-tight text-white">
            {left?.state ?? 'Select a state'} vs {right?.state ?? (compareMode === 'us' ? 'United States' : 'another state')}
          </h4>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            A balance-of-justice view for economic inequality: the heavier pan marks the larger {metric.unitLabel} value. For poverty and unemployment, justice favors the lower value.
          </p>
        </div>
        <div className="scale-metric-badge">
          <Icon size={18} />
          <span>{metric.label}</span>
        </div>
      </div>

      <div className="scale-stage" aria-label={`3D comparison scale for ${metric.label}`}>
        <JusticeScaleScene
          leftLabel={left?.state ?? 'State A'}
          rightLabel={right?.state ?? 'State B'}
          leftValueLabel={metric.format(leftValue)}
          rightValueLabel={metric.format(rightValue)}
          tilt={tilt}
          leftNorm={leftNorm}
          rightNorm={rightNorm}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="scale-insight-card">
          <p className="scale-insight-label">Left side</p>
          <p className="scale-insight-value">{left?.state ?? 'Select state'}</p>
          <p className="scale-insight-note">{metric.format(leftValue)}</p>
        </div>
        <div className="scale-insight-card">
          <p className="scale-insight-label">Difference</p>
          <p className="scale-insight-value">
            {diffPercent == null ? 'N/A' : `${diffPercent >= 0 ? '+' : ''}${diffPercent.toFixed(1)}%`}
          </p>
          <p className="scale-insight-note">Left relative to right</p>
        </div>
        <div className="scale-insight-card">
          <p className="scale-insight-label">{metric.higherIsBetter ? 'Higher value' : 'Better outcome'}</p>
          <p className="scale-insight-value">{(metric.higherIsBetter ? leader?.state : betterSide?.state) ?? 'N/A'}</p>
          <p className="scale-insight-note">
            {metric.higherIsBetter ? metric.format(leaderValue) : 'Lower is better for this metric'}
          </p>
        </div>
      </div>
    </section>
  );
};

export default ScaleComparison3D;
