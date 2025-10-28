import React, { useEffect, useRef } from 'react';
import { InequalityMetric } from '../../types';

interface BarChartProps {
  metrics: InequalityMetric[];
  compareMetrics?: InequalityMetric[];
  title: string;
}

const BarChart: React.FC<BarChartProps> = ({ metrics, compareMetrics, title }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || metrics.length === 0) return;

    // Clear previous content
    chartRef.current.innerHTML = '';

    // Set up dimensions
    const margin = { top: 20, right: 30, bottom: 80, left: 60 };
    const width = chartRef.current.clientWidth - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    // Calculate bar width and spacing
    const totalBars = compareMetrics ? metrics.length * 2 : metrics.length;
    const barWidth = Math.min(40, (width / totalBars) * 0.8);
    const groupWidth = compareMetrics ? barWidth * 2 + 10 : barWidth;
    const barSpacing = width / metrics.length;

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', (width + margin.left + margin.right).toString());
    svg.setAttribute('height', (height + margin.top + margin.bottom).toString());
    svg.style.overflow = 'visible';
    chartRef.current.appendChild(svg);

    // Create group for the chart
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
    svg.appendChild(g);

    // Add x-axis
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    xAxis.setAttribute('transform', `translate(0,${height})`);
    g.appendChild(xAxis);

    // X-axis line
    const xAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxisLine.setAttribute('x1', '0');
    xAxisLine.setAttribute('y1', '0');
    xAxisLine.setAttribute('x2', width.toString());
    xAxisLine.setAttribute('y2', '0');
    xAxisLine.setAttribute('stroke', '#e5e7eb');
    xAxis.appendChild(xAxisLine);

    // X-axis labels
    metrics.forEach((metric, i) => {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', (i * barSpacing + barSpacing / 2).toString());
      label.setAttribute('y', '20');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', '#6b7280');
      label.textContent = metric.name.split(' ')[0]; // Use first word to keep it short
      xAxis.appendChild(label);
      
      // Second line for long labels
      const label2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label2.setAttribute('x', (i * barSpacing + barSpacing / 2).toString());
      label2.setAttribute('y', '32');
      label2.setAttribute('text-anchor', 'middle');
      label2.setAttribute('font-size', '10');
      label2.setAttribute('fill', '#6b7280');
      const words = metric.name.split(' ');
      if (words.length > 1) {
        label2.textContent = words.slice(1).join(' ');
      }
      xAxis.appendChild(label2);
    });

    // Find max value for scaling
    const allValues = [
      ...metrics.map(m => m.currentValue),
      ...(compareMetrics ? compareMetrics.map(m => m.currentValue) : [])
    ];
    const maxValue = Math.max(...allValues);
    const maxScale = maxValue * 1.2; // Add 20% padding

    // Add y-axis
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.appendChild(yAxis);

    // Y-axis line
    const yAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxisLine.setAttribute('x1', '0');
    yAxisLine.setAttribute('y1', '0');
    yAxisLine.setAttribute('x2', '0');
    yAxisLine.setAttribute('y2', height.toString());
    yAxisLine.setAttribute('stroke', '#e5e7eb');
    yAxis.appendChild(yAxisLine);

    // Y-axis ticks and grid lines
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const value = (maxScale / yTicks) * i;
      const yPos = height - (height * value) / maxScale;
      
      // Tick mark
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', '0');
      tick.setAttribute('y1', yPos.toString());
      tick.setAttribute('x2', '-5');
      tick.setAttribute('y2', yPos.toString());
      tick.setAttribute('stroke', '#9ca3af');
      yAxis.appendChild(tick);
      
      // Label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', '-10');
      label.setAttribute('y', yPos.toString());
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', '#6b7280');
      label.textContent = value.toFixed(1);
      yAxis.appendChild(label);
      
      // Grid line
      const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gridLine.setAttribute('x1', '0');
      gridLine.setAttribute('y1', yPos.toString());
      gridLine.setAttribute('x2', width.toString());
      gridLine.setAttribute('y2', yPos.toString());
      gridLine.setAttribute('stroke', '#e5e7eb');
      gridLine.setAttribute('stroke-dasharray', '2,2');
      yAxis.appendChild(gridLine);
    }

    // Draw bars
    metrics.forEach((metric, i) => {
      const barHeight = (height * metric.currentValue) / maxScale;
      const xPos = compareMetrics 
        ? i * barSpacing + barSpacing / 2 - barWidth - 5 
        : i * barSpacing + barSpacing / 2 - barWidth / 2;
      
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bar.setAttribute('x', xPos.toString());
      bar.setAttribute('y', (height - barHeight).toString());
      bar.setAttribute('width', barWidth.toString());
      bar.setAttribute('height', barHeight.toString());
      bar.setAttribute('fill', '#4F46E5');
      bar.setAttribute('rx', '2');
      g.appendChild(bar);
      
      // Value label
      const valueLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      valueLabel.setAttribute('x', (xPos + barWidth / 2).toString());
      valueLabel.setAttribute('y', (height - barHeight - 5).toString());
      valueLabel.setAttribute('text-anchor', 'middle');
      valueLabel.setAttribute('font-size', '10');
      valueLabel.setAttribute('fill', '#6b7280');
      valueLabel.textContent = metric.currentValue.toFixed(1) + metric.unit;
      g.appendChild(valueLabel);
    });

    // Draw comparison bars if provided
    if (compareMetrics) {
      compareMetrics.forEach((metric, i) => {
        const barHeight = (height * metric.currentValue) / maxScale;
        const xPos = i * barSpacing + barSpacing / 2 + 5;
        
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bar.setAttribute('x', xPos.toString());
        bar.setAttribute('y', (height - barHeight).toString());
        bar.setAttribute('width', barWidth.toString());
        bar.setAttribute('height', barHeight.toString());
        bar.setAttribute('fill', '#10B981');
        bar.setAttribute('rx', '2');
        g.appendChild(bar);
        
        // Value label
        const valueLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        valueLabel.setAttribute('x', (xPos + barWidth / 2).toString());
        valueLabel.setAttribute('y', (height - barHeight - 5).toString());
        valueLabel.setAttribute('text-anchor', 'middle');
        valueLabel.setAttribute('font-size', '10');
        valueLabel.setAttribute('fill', '#6b7280');
        valueLabel.textContent = metric.currentValue.toFixed(1) + metric.unit;
        g.appendChild(valueLabel);
      });
      
      // Add legend
      const legendG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      legendG.setAttribute('transform', `translate(${width/2 - 80},${height + 50})`);
      g.appendChild(legendG);
      
      // US legend
      const usRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      usRect.setAttribute('x', '0');
      usRect.setAttribute('y', '0');
      usRect.setAttribute('width', '12');
      usRect.setAttribute('height', '12');
      usRect.setAttribute('fill', '#4F46E5');
      legendG.appendChild(usRect);
      
      const usText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      usText.setAttribute('x', '18');
      usText.setAttribute('y', '10');
      usText.setAttribute('font-size', '12');
      usText.setAttribute('fill', '#6b7280');
      usText.textContent = 'United States';
      legendG.appendChild(usText);
      
      // WA legend
      const waRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      waRect.setAttribute('x', '100');
      waRect.setAttribute('y', '0');
      waRect.setAttribute('width', '12');
      waRect.setAttribute('height', '12');
      waRect.setAttribute('fill', '#10B981');
      legendG.appendChild(waRect);
      
      const waText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      waText.setAttribute('x', '118');
      waText.setAttribute('y', '10');
      waText.setAttribute('font-size', '12');
      waText.setAttribute('fill', '#6b7280');
      waText.textContent = 'Washington';
      legendG.appendChild(waText);
    }

  }, [metrics, compareMetrics, title]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-full">
      <h3 className="text-lg font-semibold mb-2 text-gray-800">{title}</h3>
      <div ref={chartRef} className="w-full h-[250px]"></div>
    </div>
  );
};

export default BarChart;