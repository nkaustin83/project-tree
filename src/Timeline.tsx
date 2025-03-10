import React, { useState, useEffect, useRef } from 'react';
import './Timeline.css';

interface Interaction {
  id: number;
  type: 'RFI' | 'ProjectStart';
  content: string;
  date: string; // ISO format (e.g., '2025-03-01')
  daysFromStart: number; // Calculated days from project start
}

interface TimelineProps {
  interactions: Interaction[];
  projectStartDate: string; // ISO format (e.g., '2025-02-01')
}

const Timeline: React.FC<TimelineProps> = ({ interactions, projectStartDate }) => {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const startDate = new Date(projectStartDate);
  const totalDays = interactions.reduce((max, item) => Math.max(max, item.daysFromStart), 0);
  const width = 800; // SVG width
  const height = 100; // SVG height
  const lineY = 50; // Y position of the horizontal line
  const hashHeight = 10; // Default hash mark height
  const symbolRadius = 5; // Default symbol radius

  const getXPosition = (days: number) => (days / totalDays) * (width - 40) + 20;

  return (
    <div className="custom-timeline">
      <svg ref={svgRef} width={width} height={height}>
        {/* Horizontal Line */}
        <line x1="20" y1={lineY} x2={width - 20} y2={lineY} stroke="#aaa" strokeWidth="2" />

        {/* Hash Marks and Symbols */}
        {interactions.map((item) => {
          const x = getXPosition(item.daysFromStart);
          const isHovered = hoveredId === item.id;
          const hashScale = isHovered ? 0.5 : 1; // Shrink hash on hover
          const symbolScale = isHovered ? 1.5 : 1; // Enlarge symbol on hover

          return (
            <g key={item.id}>
              {/* Hash Mark */}
              <line
                x1={x}
                y1={lineY}
                x2={x}
                y2={lineY + hashHeight * hashScale}
                stroke="#aaa"
                strokeWidth="1"
              />
              {/* Symbol */}
              <circle
                cx={x}
                cy={lineY - 10}
                r={symbolRadius * symbolScale}
                fill={item.type === 'ProjectStart' ? '#ffd700' : '#ff4d4d'} // Gold for start, red for RFI
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setHoveredId(item.id)}
                style={{ cursor: 'pointer', transition: 'r 0.3s' }}
              />
              {/* Interaction Card (on hover/click) */}
              {isHovered && (
                <g>
                  <rect
                    x={x - 50}
                    y={lineY - 60}
                    width="100"
                    height="40"
                    fill="#444"
                    stroke="#aaa"
                    strokeWidth="1"
                    rx="5"
                  />
                  <text
                    x={x}
                    y={lineY - 40}
                    fill="white"
                    textAnchor="middle"
                    fontSize="12"
                  >
                    {item.content}
                  </text>
                  <text
                    x={x}
                    y={lineY - 25}
                    fill="white"
                    textAnchor="middle"
                    fontSize="10"
                  >
                    {item.date}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default Timeline;