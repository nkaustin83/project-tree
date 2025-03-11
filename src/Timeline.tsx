import React, { useState, useEffect, useRef } from 'react';
import './Timeline.css';
import { animated, useSpring } from 'react-spring';
import LeafBlowerSymbol from './LeafBlowerSymbol';
import { Interaction } from './models/InteractionTypes';

interface TimelineProps {
  interactions: Interaction[];
  projectStartDate: string;
}

const Timeline: React.FC<TimelineProps> = ({ interactions, projectStartDate }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const startDate = new Date(projectStartDate);
  const totalDays = interactions.reduce((max, item) => Math.max(max, item.day), 0);
  const maxDays = Math.max(totalDays, 60); // Ensure line extends to "10 meters" (e.g., 60 days)
  const width = 800;
  const height = 100;
  const lineY = 50;
  const hashHeight = 10;

  const getXPosition = (day: number) => {
    const x = (day / maxDays) * (width - 40) + 20;
    return Math.max(20, Math.min(x, width - 20));
  };

  // Get color based on interaction type and status (from Claude)
  const getInteractionColor = (interaction: Interaction): string => {
    const typeColors = {
      rfi: { base: '#0066cc', light: '#4d94ff', dark: '#004080' },
      submittal: { base: '#00994d', light: '#4dff9e', dark: '#006633' },
      email: { base: '#6600cc', light: '#b366ff', dark: '#3d007a' },
      change_event: { base: '#cc6600', light: '#ff9e4d', dark: '#803c00' },
      financial: { base: '#cc9900', light: '#ffdb4d', dark: '#806000' },
      projectstart: { base: '#00bcd4', light: '#4de8ff', dark: '#008ba3' }
    };

    let shade = 'base';
    switch (interaction.status) {
      case 'Open':
        shade = 'light';
        break;
      case 'In Progress':
      case 'Approved':
      case 'Rejected':
        shade = 'base';
        break;
      case 'Resolved':
      case 'Closed':
        shade = 'dark';
        break;
      default:
        shade = 'base';
    }

    return typeColors[interaction.type][shade];
  };

  // Render hover card with type-specific details (from Claude)
  const renderHoverCard = (item: Interaction) => {
    if (!item || hoveredId !== item.id) return null;

    const x = getXPosition(item.day);
    const adjustedX = Math.min(Math.max(x, 100), width - 100);

    let details = [
      `Day: ${item.day}`,
      `Status: ${item.status}`,
      `Owner: ${item.owner}`
    ];

    switch (item.type) {
      case 'rfi':
        if (item.cost_impact) details.push(`Cost Impact: $${item.cost_impact}`);
        if (item.schedule_impact) details.push(`Schedule Impact: ${item.schedule_impact} days`);
        if (item.assignee) details.push(`Assignee: ${item.assignee}`);
        break;
      case 'submittal':
        details.push(`Spec Section: ${item.spec_section}`);
        details.push(`Revision: ${item.revision_number}`);
        if (item.reviewer) details.push(`Reviewer: ${item.reviewer}`);
        break;
      case 'email':
        details.push(`Subject: ${item.subject}`);
        if (item.attachments && item.attachments.length > 0) {
          details.push(`Attachments: ${item.attachments.length}`);
        }
        break;
      case 'change_event':
        details.push(`Type: ${item.change_type}`);
        details.push(`Cost Impact: $${item.cost_impact}`);
        details.push(`Schedule Impact: ${item.schedule_impact} days`);
        break;
      case 'financial':
        details.push(`Type: ${item.financial_type}`);
        details.push(`Amount: $${item.amount.toLocaleString()}`);
        break;
      case 'projectstart':
        details.push(`Project: ${item.title}`);
        break;
    }

    return (
      <g>
        <rect
          x={adjustedX - 100}
          y={lineY - 40}
          width={200}
          height={20 + (details.length * 15)}
          rx={5}
          ry={5}
          fill="#444"
          stroke="#aaa"
          strokeWidth="1"
          opacity={0.95}
        />
        <text
          x={adjustedX}
          y={lineY - 25}
          textAnchor="middle"
          fontWeight="bold"
          fontSize="12px"
          fill="white"
        >
          {item.title}
        </text>
        {details.map((detail, index) => (
          <text
            key={index}
            x={adjustedX - 90}
            y={lineY - 10 + (index * 15)}
            textAnchor="start"
            fontSize="11px"
            fill="white"
          >
            {detail}
          </text>
        ))}
      </g>
    );
  };

  return (
    <div className="custom-timeline">
      <svg ref={svgRef} width={width} height={height + 50}>
        <line x1="20" y1={lineY} x2={width - 20} y2={lineY} stroke="#aaa" strokeWidth="2" />
        {interactions.map((item) => {
          const x = getXPosition(item.day);
          const isHovered = hoveredId === item.id;
          const hashScale = isHovered ? 0.5 : 1;

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
                type={item.type}
                status={item.status}
                onHover={(hovered: boolean) => {
                  if (hovered) setHoveredId(item.id);
                  else setHoveredId(null);
                }}
              />
              {renderHoverCard(item)}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default Timeline;