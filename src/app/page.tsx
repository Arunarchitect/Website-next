// pages/index.tsx

import React from 'react';

const Home: React.FC = () => {
  return (
    <div 
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh', // Full height of the viewport
        backgroundColor: 'black',
        color: 'white',
        textTransform: 'uppercase', // Makes text uppercase
        fontSize: '8rem', // Big text size
        margin: 0
      }}
    >
      <h1>Modelflick</h1>
    </div>
  );
}

export default Home;
