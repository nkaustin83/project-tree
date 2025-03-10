import React, { useEffect, useState } from 'react';
import './App.css';
import Timeline from './Timeline';

interface TokenData {
  token: string;
}

const App: React.FC = () => {
  const [tokenData, setTokenData] = useState<TokenData>({ token: 'Active' });

  useEffect(() => {
    console.log('Token effect triggered:', tokenData.token);
    setTokenData({ token: 'Updated Token' });
  }, [tokenData.token]);

  const projectStartDate = '2025-02-01';
  const interactions = [
    { id: 0, type: 'ProjectStart', content: 'Project Start', date: '2025-02-01', daysFromStart: 0 },
    { id: 1, type: 'RFI', content: 'TEST RFI 001', date: '2025-03-01', daysFromStart: 28, status: 'Open' },
    { id: 2, type: 'RFI', content: 'TEST RFI 002', date: '2025-03-15', daysFromStart: 42, status: 'In Progress' }
  ];

  return (
    <div className="App">
      <header className="App-header">
        <h1>Project Tree</h1>
        <p>Token: {tokenData.token}</p>
        <Timeline interactions={interactions} projectStartDate={projectStartDate} />
      </header>
    </div>
  );
};

export default App;