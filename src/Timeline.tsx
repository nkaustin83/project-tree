import React, { useState, useEffect, useRef } from 'react';
import './Timeline.css';

interface Interaction {
  id: number;
  type: 'RFI' | 'ProjectStart';
  content: string;
  date: string; // ISO format (e.g., '2025-03-01')
  daysFromStart: number; // Calculated days from project start
  status?: 'Open' | 'In Progress' | 'Resolved'; // For RFI status
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
  const maxDays = Math.max(totalDays, 60); // Ensure line extends to "10 meters" (e.g., 60 days)
  const width = 800; // SVG width (10 meters)
  const height = 100; // SVG height
  const lineY = 50; // Y position of the horizontal line
  const hashHeight = 10; // Default hash mark height
  const symbolRadius = 5; // Default symbol radius

  const getXPosition = (days: number) => {
    const x = (days / maxDays) * (width - 40) + 20;
    return Math.max(20, Math.min(x, width - 20)); // Clamp x between 20 and 780
  };

  return (
    <div className="custom-timeline">
      <svg ref={svgRef} width={width} height={height + 50}> {/* Increased height for dialogue */}
        {/* Horizontal Line */}
        <line x1="20" y1={lineY} x2={width - 20} y2={lineY} stroke="#aaa" strokeWidth="2" />

        {/* Hash Marks and Symbols */}
        {interactions.map((item) => {
          const x = getXPosition(item.daysFromStart);
          const isHovered = hoveredId === item.id;
          const hashScale = isHovered ? 0.5 : 1; // Shrink hash on hover
          const symbolScale = isHovered ? 1.5 : 1; // Enlarge symbol on hover
          const statusColor = item.type === 'ProjectStart' ? '#00bcd4' :
                            item.status === 'Open' ? '#ff4d4d' :
                            item.status === 'In Progress' ? '#ffa500' :
                            item.status === 'Resolved' ? '#4caf50' : '#00bcd4';

          let dialogueX = x - 50; // Default left-aligned
          if (x - 50 < 20) {
            dialogueX = 20; // Clamp left edge
          } else if (x + 50 > width - 20) {
            dialogueX = width - 100; // Clamp right edge
          }

          // Adjust text width dynamically if text is too long
          const textContent = item.type === 'ProjectStart' ? `Project Start (${item.date})` : `RFI (${item.status || 'Open'})`;
          const textWidth = textContent.length * 6; // Rough estimate (6px per char)
          if (textWidth > 100) {
            dialogueX = x - (textWidth / 2); // Center based on text width
            if (dialogueX < 20) dialogueX = 20;
            if (dialogueX + textWidth > width - 20) dialogueX = width - 20 - textWidth;
          }

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
                fill={statusColor}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setHoveredId(item.id)}
                style={{ cursor: 'pointer', transition: 'r 0.3s' }}
              />
              {/* Simplified Dialogue */}
              {isHovered && (
                <g>
                  <rect
                    x={dialogueX}
                    y={lineY - 40}
                    width={textWidth > 100 ? textWidth : 100}
                    height="20"
                    fill="#444"
                    stroke="#aaa"
                    strokeWidth="1"
                    rx="5"
                  />
                  <text
                    x={dialogueX + (textWidth > 100 ? textWidth / 2 : 50)} // Center text dynamically
                    y={lineY - 25}
                    fill="white"
                    textAnchor="middle"
                    fontSize="12"
                  >
                    {textContent}
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