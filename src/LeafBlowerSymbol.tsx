import React, { useState } from 'react';
import { useSpring, animated } from 'react-spring';

const LeafBlowerSymbol = ({ x, y, type, status, onHover }) => {
  const [hovered, setHovered] = useState(false);
  
  // Base colors according to type and status
  const getBaseColor = () => {
    const colors = {
      rfi: { base: '#0066cc', light: '#4d94ff', dark: '#004080' },
      submittal: { base: '#00994d', light: '#4dff9e', dark: '#006633' },
      email: { base: '#6600cc', light: '#b366ff', dark: '#3d007a' },
      change_event: { base: '#cc6600', light: '#ff9e4d', dark: '#803c00' },
      financial: { base: '#cc9900', light: '#ffdb4d', dark: '#806000' },
      projectstart: { base: '#00bcd4', light: '#4de8ff', dark: '#008ba3' }
    };
    
    const shade = status === 'Open' ? 'light' : 
                  status === 'In Progress' ? 'base' : 'dark';
    
    return colors[type][shade];
  };
  
  // Symbol shape based on type
  const getSymbolPath = () => {
    switch(type) {
      case 'rfi': 
        return "M0,-8 L7,4 L-7,4 Z"; // Triangle pointing up
      case 'submittal': 
        return "M-7,-7 L7,-7 L7,7 L-7,7 Z"; // Square
      case 'email': 
        return "M0,-8 A8,8 0 1,1 0,8 A8,8 0 1,1 0,-8 Z"; // Circle
      case 'change_event': 
        return "M0,-9 L5,0 L0,9 L-5,0 Z"; // Diamond
      case 'financial': 
        return "M-3,-8 L3,-8 L8,0 L3,8 L-3,8 L-8,0 Z"; // Hexagon
      case 'projectstart': 
        return "M0,-10 L10,0 L0,10 L-10,0 Z"; // Star
      default:
        return "M0,-8 L7,4 L-7,4 Z"; // Default to triangle
    }
  };
  
  // Animation spring for hover effect
  const symbolSpring = useSpring({
    transform: hovered 
      ? `translate(${x}px, ${y - 20}px) scale(1.5)` 
      : `translate(${x}px, ${y}px) scale(1)`,
    opacity: hovered ? 1 : 0.8,
    config: { mass: 1, tension: 180, friction: 12 }
  });
  
  // Animation for supporting "leaf" particles
  const particles = [...Array(5)].map((_, i) => {
    const randomX = Math.random() * 30 - 15;
    const randomScale = 0.3 + Math.random() * 0.3;
    
    return useSpring({
      transform: hovered 
        ? `translate(${x + randomX}px, ${y - 40 - (i * 15)}px) scale(${randomScale})` 
        : `translate(${x}px, ${y}px) scale(0)`,
      opacity: hovered ? 0.6 - (i * 0.1) : 0,
      config: { mass: 0.5, tension: 120, friction: 8 + (i * 2) }
    });
  });
  
  return (
    <>
      {/* Main symbol */}
      <animated.path
        d={getSymbolPath()}
        fill={getBaseColor()}
        stroke="#ffffff"
        strokeWidth="1"
        style={symbolSpring}
        onMouseEnter={() => {
          setHovered(true);
          if (onHover) onHover(true);
        }}
        onMouseLeave={() => {
          setHovered(false);
          if (onHover) onHover(false);
        }}
      />
      
      {/* Particle "leaves" that float up on hover */}
      {particles.map((style, index) => (
        <animated.path
          key={index}
          d="M0,-3 L2,0 L0,3 L-2,0 Z" // Simple diamond shape for particles
          fill={getBaseColor()}
          opacity={0.5}
          style={style}
        />
      ))}
    </>
  );
};

export default LeafBlowerSymbol;