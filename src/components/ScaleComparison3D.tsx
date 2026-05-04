import React from 'react';
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

const ScaleComparison3D: React.FC<ScaleComparison3DProps> = ({ left, right, metricKey, compareMode }) => {
  const metric = SCALE_METRICS.find((item) => item.key === metricKey) ?? SCALE_METRICS[0];
  const leftValue = getMetricValue(left, metric.key);
  const rightValue = getMetricValue(right, metric.key);
  const leftNorm = metric.normalize(leftValue);
  const rightNorm = metric.normalize(rightValue);
  const rawTilt = (rightNorm - leftNorm) * 18;
  const tilt = Math.max(-9, Math.min(9, rawTilt));
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
        <div className="scale-horizon" />
        <div className="scale-scene">
          <div className="scale-post">
            <span className="scale-spire" />
            <span className="scale-column-ridges" />
          </div>
          <div className="scale-base">
            <span />
            <span />
            <span />
          </div>
          <div className="scale-beam-wrap" style={{ transform: `translateX(-50%) rotateZ(${tilt}deg)` }}>
            <svg className="scale-beam-svg" viewBox="0 0 640 120" role="presentation" aria-hidden="true">
              <defs>
                <linearGradient id="scaleGoldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#b7791f" />
                  <stop offset="18%" stopColor="#fef3c7" />
                  <stop offset="48%" stopColor="#d8ad49" />
                  <stop offset="76%" stopColor="#facc15" />
                  <stop offset="100%" stopColor="#92400e" />
                </linearGradient>
              </defs>
              <path className="scale-beam-shadow" d="M96 78 C158 32, 226 36, 292 55 C307 59, 333 59, 348 55 C414 36, 482 32, 544 78" />
              <path className="scale-beam-curve" d="M96 72 C158 26, 226 30, 292 51 C307 55, 333 55, 348 51 C414 30, 482 26, 544 72" />
              <path className="scale-beam-lip" d="M286 51 C302 68, 338 68, 354 51" />
              <circle className="scale-beam-center" cx="320" cy="56" r="18" />
              <circle className="scale-beam-rivet" cx="320" cy="56" r="5" />
              <circle className="scale-beam-rivet" cx="108" cy="69" r="5" />
              <circle className="scale-beam-rivet" cx="532" cy="69" r="5" />
            </svg>
            <div className="scale-chain-group scale-chain-group-left">
              <span className="scale-chain scale-chain-a" />
              <span className="scale-chain scale-chain-b" />
              <span className="scale-chain scale-chain-c" />
            </div>
            <div className="scale-chain-group scale-chain-group-right">
              <span className="scale-chain scale-chain-a" />
              <span className="scale-chain scale-chain-b" />
              <span className="scale-chain scale-chain-c" />
            </div>
            <div className="scale-pan scale-pan-left" style={{ '--pan-counter': `${-tilt}deg` } as React.CSSProperties}>
              <span className="scale-pan-dish" />
              <span className="scale-pan-label">{left?.state ?? 'State A'}</span>
              <strong>{metric.format(leftValue)}</strong>
            </div>
            <div className="scale-pan scale-pan-right" style={{ '--pan-counter': `${-tilt}deg` } as React.CSSProperties}>
              <span className="scale-pan-dish" />
              <span className="scale-pan-label">{right?.state ?? 'State B'}</span>
              <strong>{metric.format(rightValue)}</strong>
            </div>
          </div>
        </div>
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
