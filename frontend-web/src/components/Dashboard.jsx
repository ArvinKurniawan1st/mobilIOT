import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { waypointsAPI, controlAPI, tripsAPI } from '../api/client';
import { Navigation, Gauge, Play, Square, MapPin, Plus } from 'lucide-react';
// import './Dashboard.css';

const Dashboard = () => {
  const { telemetry, isConnected, sendControl } = useWebSocket();
  const [waypoints, setWaypoints] = useState([]);
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [mode, setMode] = useState('manual');
  const [speed, setSpeed] = useState(150);
  const [activeTrip, setActiveTrip] = useState(null);
  const [showAddWaypoint, setShowAddWaypoint] = useState(false);

  useEffect(() => {
    loadWaypoints();
    loadActiveTrip();
  }, []);

  const loadWaypoints = async () => {
    try {
      const response = await waypointsAPI.getAll();
      setWaypoints(response.data.waypoints);
    } catch (error) {
      console.error('Failed to load waypoints:', error);
    }
  };

  const loadActiveTrip = async () => {
    try {
      const response = await tripsAPI.getActive();
      setActiveTrip(response.data.trip);
    } catch (error) {
      console.error('Failed to load active trip:', error);
    }
  };

  const handleManualControl = (direction) => {
    sendControl('manual', { direction, speed });
  };

  const handleStartAuto = async () => {
    if (!selectedWaypoint) {
      alert('Please select a waypoint first!');
      return;
    }

    try {
      // Start trip
      await tripsAPI.start({
        end_waypoint_id: selectedWaypoint.id,
        mode: 'auto'
      });

      // Send target to ESP32
      await controlAPI.sendCommand('setTarget', {
        x: selectedWaypoint.x_coordinate,
        y: selectedWaypoint.y_coordinate
      });

      // Start auto drive
      await controlAPI.sendCommand('start', {});
      
      loadActiveTrip();
      alert('Auto drive started!');
    } catch (error) {
      alert('Failed to start auto drive');
      console.error(error);
    }
  };

  const handleStop = async () => {
    try {
      await controlAPI.sendCommand('stop', {});
      
      if (activeTrip) {
        await tripsAPI.end(activeTrip.id, {
          distance_traveled: activeTrip.distance_traveled || 0,
          avg_speed: telemetry?.speed || 0,
          max_speed: telemetry?.speed || 0
        });
      }
      
      loadActiveTrip();
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  };

  const handleAddWaypoint = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
      await waypointsAPI.create({
        name: formData.get('name'),
        x_coordinate: parseFloat(formData.get('x')),
        y_coordinate: parseFloat(formData.get('y')),
        description: formData.get('description')
      });
      
      loadWaypoints();
      setShowAddWaypoint(false);
      e.target.reset();
    } catch (error) {
      alert('Failed to add waypoint');
      console.error(error);
    }
  };

  const handleDeleteWaypoint = async (id) => {
    if (window.confirm('Delete this waypoint?')) {
      try {
        await waypointsAPI.delete(id);
        loadWaypoints();
        if (selectedWaypoint?.id === id) {
          setSelectedWaypoint(null);
        }
      } catch (error) {
        alert('Failed to delete waypoint');
        console.error(error);
      }
    }
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>🚗 Auto Drive Navigation</h1>
        <div className="header-controls">
          <div className="mode-toggle">
            <button 
              className={mode === 'manual' ? 'active' : ''}
              onClick={() => setMode('manual')}
            >
              Manual
            </button>
            <button 
              className={mode === 'auto' ? 'active' : ''}
              onClick={() => setMode('auto')}
            >
              Auto
            </button>
          </div>
          <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '● Connected' : '● Disconnected'}
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Left Panel - Speed & Control */}
        <div className="panel">
          <h3>Speed Monitor</h3>
          
          <div className="speedometer">
            <svg viewBox="0 0 200 200" className="speed-circle">
              <circle cx="100" cy="100" r="90" fill="none" stroke="#333" strokeWidth="10"/>
              <circle 
                cx="100" cy="100" r="90" 
                fill="none" 
                stroke="#3b82f6" 
                strokeWidth="10"
                strokeDasharray="565"
                strokeDashoffset={565 - (565 * (telemetry?.speed || 0) / 120)}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
              />
            </svg>
            <div className="speed-display">
              <div className="speed-num">
                {telemetry?.speed != null 
                  ? Math.round(parseFloat(telemetry.speed))
                  : 0}
              </div>
              <div className="speed-unit">km/h</div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-label">Position X</div>
              <div className="stat-value">
                {telemetry?.x_position != null 
                  ? parseFloat(telemetry.x_position).toFixed(2) 
                  : '0.00'} m
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Position Y</div>
              <div className="stat-value">
                {telemetry?.y_position != null 
                  ? parseFloat(telemetry.y_position).toFixed(2) 
                  : '0.00'} m
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Heading</div>
              <div className="stat-value">
                {telemetry?.heading != null 
                  ? Math.round(parseFloat(telemetry.heading))
                  : 0}°
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Distance</div>
              <div className="stat-value">
                {(() => {
                  if (!selectedWaypoint || !telemetry) return '0.00';
                  try {
                    const dx = parseFloat(telemetry.x_position || 0) - parseFloat(selectedWaypoint.x_coordinate);
                    const dy = parseFloat(telemetry.y_position || 0) - parseFloat(selectedWaypoint.y_coordinate);
                    return Math.sqrt(dx * dx + dy * dy).toFixed(2);
                  } catch (e) {
                    return '0.00';
                  }
                })()} m
              </div>
            </div>
          </div>

          {/* Manual Control */}
          {mode === 'manual' && (
            <div className="manual-control">
              <label>Speed: {Math.round(speed/255*100)}%</label>
              <input 
                type="range" 
                min="0" 
                max="255" 
                value={speed}
                onChange={(e) => setSpeed(parseInt(e.target.value))}
                className="speed-slider"
              />
              
              <div className="d-pad">
                <div></div>
                <button 
                  className="d-btn"
                  onMouseDown={() => handleManualControl('forward')}
                  onMouseUp={() => handleManualControl('stop')}
                >▲</button>
                <div></div>
                
                <button 
                  className="d-btn"
                  onMouseDown={() => handleManualControl('left')}
                  onMouseUp={() => handleManualControl('stop')}
                >◄</button>
                <button 
                  className="d-btn center"
                  onClick={() => handleManualControl('stop')}
                >■</button>
                <button 
                  className="d-btn"
                  onMouseDown={() => handleManualControl('right')}
                  onMouseUp={() => handleManualControl('stop')}
                >►</button>
                
                <div></div>
                <button 
                  className="d-btn"
                  onMouseDown={() => handleManualControl('backward')}
                  onMouseUp={() => handleManualControl('stop')}
                >▼</button>
                <div></div>
              </div>
            </div>
          )}

          {/* Auto Control */}
          {mode === 'auto' && (
            <div className="auto-control">
              <button className="btn-start" onClick={handleStartAuto}>
                <Play size={20} /> Start Auto Drive
              </button>
              <button className="btn-stop" onClick={handleStop}>
                <Square size={20} /> Stop
              </button>
            </div>
          )}

          {/* Obstacle Info */}
          <div className="obstacle-panel">
            <h4>Obstacle Detection</h4>
            <div className="obstacle-row">
              <span>Front:</span>
              <span className="obstacle-value">{telemetry?.distance_front || '--'} cm</span>
            </div>
            <div className="obstacle-row">
              <span>Left:</span>
              <span className="obstacle-value">{telemetry?.distance_left || '--'} cm</span>
            </div>
            <div className="obstacle-row">
              <span>Right:</span>
              <span className="obstacle-value">{telemetry?.distance_right || '--'} cm</span>
            </div>
          </div>
        </div>

        {/* Center Panel - Map */}
        <div className="panel">
          <h3>Navigation Map</h3>
          <div className="map-container">
            <svg viewBox="-12 -12 24 24" className="map-svg">
              <defs>
                <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
                  <path d="M 1 0 L 0 0 0 1" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.05"/>
                </pattern>
              </defs>
              <rect x="-12" y="-12" width="24" height="24" fill="url(#grid)" />
              
              {/* Waypoints */}
              {waypoints.map((wp) => (
                <g key={wp.id}>
                  <circle
                    cx={wp.x_coordinate}
                    cy={-wp.y_coordinate}
                    r="0.4"
                    fill={selectedWaypoint?.id === wp.id ? '#ef4444' : '#888'}
                    onClick={() => setSelectedWaypoint(wp)}
                    style={{ cursor: 'pointer' }}
                  />
                  <text
                    x={wp.x_coordinate + 0.6}
                    y={-wp.y_coordinate + 0.2}
                    fontSize="0.6"
                    fill="white"
                  >
                    {wp.name}
                  </text>
                </g>
              ))}
              
              {/* Car position */}
              {telemetry && (
                <g>
                  <circle
                    cx={parseFloat(telemetry.x_position) || 0}
                    cy={-(parseFloat(telemetry.y_position) || 0)}
                    r="0.5"
                    fill="#3b82f6"
                  />
                  <line
                    x1={parseFloat(telemetry.x_position) || 0}
                    y1={-(parseFloat(telemetry.y_position) || 0)}
                    x2={(parseFloat(telemetry.x_position) || 0) + Math.cos((parseFloat(telemetry.heading) || 0) * Math.PI / 180) * 1}
                    y2={-(parseFloat(telemetry.y_position) || 0) - Math.sin((parseFloat(telemetry.heading) || 0) * Math.PI / 180) * 1}
                    stroke="#3b82f6"
                    strokeWidth="0.2"
                  />
                </g>
              )}
            </svg>
          </div>
          
          <div className="map-info">
            <div className="info-row">
              <span>Current Position:</span>
              <span>
              X: {telemetry?.x_position != null ? parseFloat(telemetry.x_position).toFixed(2) : '0.00'}m, 
              Y: {telemetry?.y_position != null ? parseFloat(telemetry.y_position).toFixed(2) : '0.00'}m
            </span>
            </div>
            {selectedWaypoint && (
              <div className="info-row">
                <span>Target:</span>
                <span>{selectedWaypoint.name} ({selectedWaypoint.x_coordinate}, {selectedWaypoint.y_coordinate})</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Waypoints */}
        <div className="panel">
          <div className="panel-header">
            <h3>Waypoints</h3>
            <button className="btn-add" onClick={() => setShowAddWaypoint(!showAddWaypoint)}>
              <Plus size={16} /> Add
            </button>
          </div>

          {showAddWaypoint && (
            <form className="add-waypoint-form" onSubmit={handleAddWaypoint}>
              <input name="name" placeholder="Name" required />
              <div className="coord-inputs">
                <input name="x" type="number" step="0.1" placeholder="X" required />
                <input name="y" type="number" step="0.1" placeholder="Y" required />
              </div>
              <input name="description" placeholder="Description" />
              <div className="form-buttons">
                <button type="submit" className="btn-save">Save</button>
                <button type="button" className="btn-cancel" onClick={() => setShowAddWaypoint(false)}>Cancel</button>
              </div>
            </form>
          )}

          <div className="waypoint-list">
            {waypoints.map((wp) => (
              <div
                key={wp.id}
                className={`waypoint-item ${selectedWaypoint?.id === wp.id ? 'active' : ''}`}
                onClick={() => setSelectedWaypoint(wp)}
              >
                <MapPin size={16} />
                <div className="waypoint-info">
                  <div className="wp-name">{wp.name}</div>
                  <div className="wp-coords">
                    ({wp.x_coordinate}, {wp.y_coordinate})
                  </div>
                </div>
                <button 
                  className="btn-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteWaypoint(wp.id);
                  }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;