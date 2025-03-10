import React, { useEffect, useState, useRef } from 'react';
import './App.css';
import { Timeline, DataSet } from 'vis-timeline/standalone';

interface TokenData {
  token: string;
}

interface TimelineItem {
  id: number;
  content: string;
  start: string;
  className?: string;
}

const App: React.FC = () => {
  const [tokenData, setTokenData] = useState<TokenData>({ token: 'Active' });
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineInstance = useRef<Timeline | null>(null);

  useEffect(() => {
    console.log('Token effect triggered:', tokenData.token);
    setTokenData({ token: 'Updated Token' });
  }, [tokenData.token]);

  useEffect(() => {
    if (timelineRef.current && !timelineInstance.current) {
      const items = new DataSet<TimelineItem>([
        { id: 1, content: 'TEST RFI 001', start: '2025-03-01', className: 'red-dot' }
      ]);
      const options = {
        height: '300px',
        width: '100%',
        format: { minorLabels: { day: 'D MMM' } }
      };
      const timeline = new Timeline(timelineRef.current, items, options);
      timelineInstance.current = timeline;

      // Cleanup on unmount
      return () => {
        if (timelineInstance.current) {
          timelineInstance.current.destroy();
        }
      };
    }
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Project Tree</h1>
        <p>Token: {tokenData.token}</p>
        <div ref={timelineRef} id="timeline" style={{ height: '300px', width: '100%' }}></div>
      </header>
    </div>
  );
};

export default App;