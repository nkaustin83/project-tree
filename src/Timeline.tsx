import React, { useState, useEffect, useRef } from 'react';
import './Timeline.css';
import { animated, useSpring } from 'react-spring'; // Import react-spring
import LeafBlowerSymbol from './LeafBlowerSymbol'; // Create this file below

interface Interaction {
  id: number;
  type: 'RFI' | 'ProjectStart' | 'Submittal' | 'Email' | 'ChangeEvent' | 'Financial';
  content: string;
  date: string;
  daysFromStart: number;
  status?: 'Open' | 'In Progress' | 'Resolved';
}

interface TimelineProps {
  interactions: Interaction[];
  projectStartDate: string;
}

const Timeline: React.FC<TimelineProps> = ({ interactions, projectStartDate }) => {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const startDate = new Date(projectStartDate);
  const totalDays = interactions.reduce((max, item) => Math.max(max, item.daysFromStart), 0);
  const maxDays = Math.max(totalDays, 60); // Ensure line extends to "10 meters" (e.g., 60 days)
  const width = 800;
  const height = 100;
  const lineY = 50;
  const hashHeight = 10;
  const symbolRadius = 5;

  const getXPosition = (days: number) => {
    const x = (days / maxDays) * (width - 40) + 20;
    return Math.max(20, Math.min(x, width - 20));
  };

  return (
    <div className="custom-timeline">
      <svg ref={svgRef} width={width} height={height + 50}>
        <line x1="20" y1={lineY} x2={width - 20} y2={lineY} stroke="#aaa" strokeWidth="2" />
        {interactions.map((item) => {
          const x = getXPosition(item.daysFromStart);
          const isHovered = hoveredId === item.id;
          const hashScale = isHovered ? 0.5 : 1;
          const symbolScale = isHovered ? 1.5 : 1;
          const statusColor = item.type === 'ProjectStart' ? '#00bcd4' :
                            item.status === 'Open' ? '#ff4d4d' :
                            item.status === 'In Progress' ? '#ffa500' :
                            item.status === 'Resolved' ? '#4caf50' : '#00bcd4';

          let dialogueX = x - 50;
          if (x - 50 < 20) dialogueX = 20;
          else if (x + 50 > width - 20) dialogueX = width - 100;

          const textContent = item.type === 'ProjectStart' ? `Project Start (${item.date})` : `RFI (${item.status || 'Open'})`;
          const textWidth = textContent.length * 6;
          const boxWidth = textWidth > 100 ? textWidth : 100;

          return (
            <g key={item.id}>
              <line
                x1={x}
                y1={lineY}
                x2={x}
                y2={lineY + hashHeight * hashScale}
                stroke="#aaa"
                strokeWidth="1"
              />
              <LeafBlowerSymbol
                x={x}
                y={lineY - 10}
                type={item.type.toLowerCase() as 'rfi' | 'submittal' | 'email' | 'change_event' | 'financial' | 'projectstart'}
                status={item.status || 'Open'}
                onHover={(hovered: boolean) => {
                  if (hovered) setHoveredId(item.id);
                  else setHoveredId(null);
                }}
              />
              {isHovered && (
                <g>
                  <rect
                    x={dialogueX}
                    y={lineY - 40}
                    width={boxWidth}
                    height="20"
                    fill="#444"
                    stroke="#aaa"
                    strokeWidth="1"
                    rx="5"
                  />
                  <text
                    x={dialogueX + (boxWidth / 2)}
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