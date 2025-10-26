import React from 'react';
import './CanvasBoard.css'; // Styles are shared in the main CSS file

const CButton = ({ label, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} className="c-button">
    {label}
  </button>
);

export default CButton;