import React, { useEffect, useRef } from 'react';
import { TimeSeriesPoint } from '../../types';

interface LineChartProps {
  title: string;
  data: TimeSeriesPoint[];
  unit: string;
  domain: [number, number];
  color?: string;
}

const LineChart: React.FC<LineChartProps> = ({
  title,
  data,
  unit,
  domain,
  color = '#4F46E5'
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !data.length) return;

    // Clear previous content
    chartRef.current.innerHTML = '';

    // Set up dimensions
    const margin = { top: 20, right: 30, bottom: 30, left: 60 };
    const width = chartRef.current.clientWidth - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    // Find the min and max values for x and y axes
    const minYear = Math.min(...data.map(d => d.year));
    const maxYear = Math.max(...data.map(d => d.year));
    const maxValue = Math.max(...data.map(d => d.value));

    // Set up scales
    const xScale = (x: number) => {
      // Handle case where all points are in the same year
      if (minYear === maxYear) {
        return width / 2; // Center the point
      }
      return ((x - minYear) / (maxYear - minYear)) * width;
    };

    const yScale = (y: number) => {
      return height - ((y - domain[0]) / (domain[1] - domain[0])) * height;
    };

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

    // X-axis ticks - show only 5 evenly spaced years
    const yearStep = Math.ceil((maxYear - minYear) / 4);
    const years = minYear === maxYear 
      ? [minYear] // If all points are in the same year, just show that year
      : Array.from({ length: 5 }, (_, i) => minYear + i * yearStep).filter(year => year <= maxYear);

    if (minYear !== maxYear && years[years.length - 1] !== maxYear) {
      years.push(maxYear);
    }

    years.forEach(year => {
      const tickX = xScale(year);
      
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', tickX.toString());
      tick.setAttribute('y1', '0');
      tick.setAttribute('x2', tickX.toString());
      tick.setAttribute('y2', '5');
      tick.setAttribute('stroke', '#9ca3af');
      xAxis.appendChild(tick);
      
      const tickLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tickLabel.setAttribute('x', tickX.toString());
      tickLabel.setAttribute('y', '20');
      tickLabel.setAttribute('text-anchor', 'middle');
      tickLabel.setAttribute('font-size', '10');
      tickLabel.setAttribute('fill', '#6b7280');
      tickLabel.textContent = year.toString();
      xAxis.appendChild(tickLabel);
    });

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

    // Y-axis ticks
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const value = (domain[1] - domain[0]) * (i / yTicks) + domain[0];
      const yPos = yScale(value);
      
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', '0');
      tick.setAttribute('y1', yPos.toString());
      tick.setAttribute('x2', '-5');
      tick.setAttribute('y2', yPos.toString());
      tick.setAttribute('stroke', '#9ca3af');
      yAxis.appendChild(tick);
      
      const tickLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tickLabel.setAttribute('x', '-10');
      tickLabel.setAttribute('y', yPos.toString());
      tickLabel.setAttribute('text-anchor', 'end');
      tickLabel.setAttribute('dominant-baseline', 'middle');
      tickLabel.setAttribute('font-size', '10');
      tickLabel.setAttribute('fill', '#6b7280');
      tickLabel.textContent = unit ? `${unit}${value.toLocaleString()}` : value.toLocaleString();
      yAxis.appendChild(tickLabel);
      
      // Grid lines
      const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gridLine.setAttribute('x1', '0');
      gridLine.setAttribute('y1', yPos.toString());
      gridLine.setAttribute('x2', width.toString());
      gridLine.setAttribute('y2', yPos.toString());
      gridLine.setAttribute('stroke', '#e5e7eb');
      gridLine.setAttribute('stroke-dasharray', '2,2');
      yAxis.appendChild(gridLine);
    }

    // Draw line
    if (data.length > 1) {
      const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      let d = `M ${xScale(data[0].year)} ${yScale(data[0].value)}`;
      
      for (let i = 1; i < data.length; i++) {
        d += ` L ${xScale(data[i].year)} ${yScale(data[i].value)}`;
      }
      
      linePath.setAttribute('d', d);
      linePath.setAttribute('fill', 'none');
      linePath.setAttribute('stroke', color);
      linePath.setAttribute('stroke-width', '2');
      g.appendChild(linePath);
    }
    
    // Add data points
    data.forEach(point => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', xScale(point.year).toString());
      circle.setAttribute('cy', yScale(point.value).toString());
      circle.setAttribute('r', '3');
      circle.setAttribute('fill', 'white');
      circle.setAttribute('stroke', color);
      circle.setAttribute('stroke-width', '2');
      g.appendChild(circle);

      // Only show value labels for the years we're displaying on the x-axis
      if (years.includes(point.year)) {
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', xScale(point.year).toString());
        label.setAttribute('y', (yScale(point.value) - 10).toString());
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '10');
        label.setAttribute('fill', '#6b7280');
        label.textContent = unit ? `${unit}${point.value.toLocaleString()}` : point.value.toLocaleString();
        g.appendChild(label);
      }
    });

  }, [data, unit, domain, color, title]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-full">
      <h3 className="text-lg font-semibold mb-2 text-gray-800">{title}</h3>
      <div ref={chartRef} className="w-full h-[250px]"></div>
    </div>
  );
};

export default LineChart;