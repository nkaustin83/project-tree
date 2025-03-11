import React, { useEffect, useState } from 'react';
import './App.css';
import Timeline from './Timeline';
import { sampleTimelineData } from './data/sampleData';

interface TokenData {
  token: string;
}

const App: React.FC = () => {
  const [tokenData, setTokenData] = useState<TokenData>({ token: 'Active' });

  useEffect(() => {
    console.log('Token effect triggered:', tokenData.token);
    setTokenData({ token: 'Updated Token' });
  }, [tokenData.token]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Project Tree - AEC Timeline</h1>
        <p>Token: {tokenData.token}</p>
      </header>
      <main>
        <div className="timeline-container">
          <Timeline
            interactions={sampleTimelineData.interactions}
            projectStartDate={sampleTimelineData.project.start_date}
          />
        </div>
      </main>
    </div>
  );
};

export default App;