import React from 'react';
import CButton from './CButton';
import './CanvasBoard.css'; // Styles are shared in the main CSS file

const WelcomeCard = ({ sign, onSign }) => (
  <div className="welcome-card-content">
    <h2 style={{ marginTop: 0 }}>Hey! Sign my page!</h2>
    <p>
      Sign my page your way by clicking the button below.
      <br />
      Cooldown has not been implemented as of yet, so this is operating on an honor based system, so chill out.  
      <br />
      <br />
      
      <a href="https://github.com/ozzeau/simypa" target="_blank" rel="noopener noreferrer"style={{ color: '#FFA500', textDecoration: 'underline' }}>How</a> it works

    </p>
    <CButton label={sign} onClick={onSign} />
  </div>
);

export default WelcomeCard;
