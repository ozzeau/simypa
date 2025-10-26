import React from 'react';
import CButton from './CButton';
import './CanvasBoard.css'; // Styles are shared in the main CSS file

const WelcomeCard = ({ sign, onSign }) => (
  <div className="welcome-card-content">
    <h2 style={{ marginTop: 0 }}>Welcome to the Canvas</h2>
    <p>Pan around to see other signatures or switch to Draw mode to add your own.</p>
    <CButton label={sign} onClick={onSign} />
  </div>
);

export default WelcomeCard;