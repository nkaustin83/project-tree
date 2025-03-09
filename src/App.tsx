import React, { useEffect, useState } from 'react';
import './App.css';
import { Timeline } from 'vis-timeline/standalone';

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
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  useEffect(() => {
    console.log('Token effect triggered:', tokenData.token);
    setTokenData({ token: 'Updated Token' });
  }, [tokenData.token]);

  useEffect(() => {
    const container = document.getElementById('timeline');
    if (container && !timeline) {
      const items: TimelineItem[] = [
        { id: 1, content: 'TEST RFI 001', start: '2025-03-01', className: 'red-dot' }
      ];
      const options = {
        height: '300px',
        format: { minorLabels: { day: 'D MMM' } }
      };
      const newTimeline = new Timeline(container, items, options);
      setTimeline(newTimeline);
    }
  }, [timeline]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Project Tree</h1>
        <p>Token: {tokenData.token}</p>
        <div id="timeline" />
      </header>
    </div>
  );
};

export default App;