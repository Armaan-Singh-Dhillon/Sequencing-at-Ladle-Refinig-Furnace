import './App.css';
import styled from "styled-components";
import React, { useState, useEffect } from 'react';
import socketIOClient from 'socket.io-client';
import Sharedlayout from './components/Sharedlayout';
import { Route, Routes } from "react-router-dom";
import EnergyReport from './components/EnergyReport';

function App() {
  const [loading, setLoading] = useState(true);
  const [latest, setLatest] = useState({ 'intersecting': false, 'total_time': -1 });
  const ENDPOINT = 'http://localhost:4999';

  useEffect(() => {
    const socket = socketIOClient(ENDPOINT);

    socket.on('connect', () => {
      console.log(`Connected with id: ${socket.id}`);
    });

    socket.on('object_data', (data) => {
      // Check if total_time has changed significantly
      if (Math.abs(data.total_time - latest.total_time) > 0.5) { // Adjust threshold as needed
        setLatest(data); // Update state only on meaningful change
      }
      setLoading(false)
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    return () => {
      socket.disconnect();
    };
  }, [latest]); // Depend on latest to ensure useEffect re-runs when latest changes

  return (
    <Wrapper>
      {loading ? (
        <div className='loader-container'>
          <div className="loading-spinner">
            <div className="spinner"></div>
            <div>Loading</div>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/" element={<Sharedlayout />}>
            <Route path="/" element={<EnergyReport dataEmit={latest} />} />
          </Route>
        </Routes>
      )}
    </Wrapper>
  );
}

const Wrapper = styled.div`
  .bar {
    color: #4deeea;
  }

  .loader-container {
    display: flex;
    justify-content: space-evenly;
    flex-direction: column;
    align-items: center;
    justify-content: space-evenly;
    height: 100vh;
  }

  .loading-spinner {
    width: 20%;
    height: 20%;
    background-color: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: space-evenly;
  }

  .spinner {
    border: 6px solid rgba(0, 0, 0, 0.1);
    border-left-color: #7983ff;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
    background-color: white;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

export default App;
