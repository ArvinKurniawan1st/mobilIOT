import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { useWebSocket } from '../hooks/useWebSocket';
import { waypointsAPI, controlAPI, tripsAPI } from '../api/client';
import { CONFIG } from '../config';

// Helper function untuk safely convert to number
const safeNumber = (value, defaultValue = 0) => {
  if (value == null || value === '') return defaultValue;
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};

const DashboardScreen = () => {
  const { telemetry, isConnected, sendControl } = useWebSocket();
  const [mode, setMode] = useState('manual');
  const [speed, setSpeed] = useState(150);
  const [waypoints, setWaypoints] = useState([]);
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [newWaypoint, setNewWaypoint] = useState({
    name: '',
    x: '',
    y: '',
    description: ''
  });

  useEffect(() => {
    loadWaypoints();
    loadActiveTrip();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWaypoints();
    await loadActiveTrip();
    setRefreshing(false);
  };

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
      Alert.alert('Error', 'Please select a waypoint first!');
      return;
    }

    try {
      await tripsAPI.start({
        end_waypoint_id: selectedWaypoint.id,
        mode: 'auto'
      });

      await controlAPI.sendCommand('setTarget', {
        x: selectedWaypoint.x_coordinate,
        y: selectedWaypoint.y_coordinate
      });

      await controlAPI.sendCommand('start', {});

      loadActiveTrip();
      Alert.alert('Success', 'Auto drive started!');
    } catch (error) {
      Alert.alert('Error', 'Failed to start auto drive');
      console.error(error);
    }
  };

  const handleStop = async () => {
    try {
      await controlAPI.sendCommand('stop', {});

      if (activeTrip) {
        await tripsAPI.end(activeTrip.id, {
          distance_traveled: 0,
          avg_speed: safeNumber(telemetry?.speed),
          max_speed: safeNumber(telemetry?.speed)
        });
      }

      loadActiveTrip();
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  };

  const handleAddWaypoint = async () => {
    if (!newWaypoint.name || !newWaypoint.x || !newWaypoint.y) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    try {
      await waypointsAPI.create({
        name: newWaypoint.name,
        x_coordinate: parseFloat(newWaypoint.x),
        y_coordinate: parseFloat(newWaypoint.y),
        description: newWaypoint.description
      });

      loadWaypoints();
      setShowAddModal(false);
      setNewWaypoint({ name: '', x: '', y: '', description: '' });
      Alert.alert('Success', 'Waypoint added!');
    } catch (error) {
      Alert.alert('Error', 'Failed to add waypoint');
      console.error(error);
    }
  };

  const handleDeleteWaypoint = async (id) => {
    Alert.alert(
      'Delete Waypoint',
      'Are you sure you want to delete this waypoint?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await waypointsAPI.delete(id);
              loadWaypoints();
              if (selectedWaypoint?.id === id) {
                setSelectedWaypoint(null);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete waypoint');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚗 Auto Drive</Text>
        <View style={styles.headerRight}>
          <View style={[styles.statusBadge,
            { backgroundColor: isConnected ? '#059669' : '#ef4444' }
          ]}>
            <Text style={styles.statusText}>
              {isConnected ? 'Connected' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'manual' && styles.modeButtonActive]}
          onPress={() => setMode('manual')}
        >
          <Text style={[styles.modeText, mode === 'manual' && styles.modeTextActive]}>
            Manual
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'auto' && styles.modeButtonActive]}
          onPress={() => setMode('auto')}
        >
          <Text style={[styles.modeText, mode === 'auto' && styles.modeTextActive]}>
            Auto
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Speedometer */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Speed Monitor</Text>
          <View style={styles.speedometer}>
            <Text style={styles.speedValue}>
              {Math.round(safeNumber(telemetry?.speed))}
            </Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>

          {/* Stats Grid - FIXED VERSION */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Position X</Text>
              <Text style={styles.statValue}>
                {safeNumber(telemetry?.x_position).toFixed(2)} m
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Position Y</Text>
              <Text style={styles.statValue}>
                {safeNumber(telemetry?.y_position).toFixed(2)} m
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Heading</Text>
              <Text style={styles.statValue}>
                {Math.round(safeNumber(telemetry?.heading))}°
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Front Dist</Text>
              <Text style={styles.statValue}>
                {telemetry?.distance_front != null ? safeNumber(telemetry.distance_front) : '--'} cm
              </Text>
            </View>
          </View>
        </View>

        {/* Manual Control */}
        {mode === 'manual' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Manual Control</Text>

            <View style={styles.speedControl}>
              <Text style={styles.speedLabel}>Speed: {Math.round(speed/255*100)}%</Text>
            </View>

            <View style={styles.dPad}>
              <View style={styles.dPadRow}>
                <View style={styles.dPadEmpty} />
                <TouchableOpacity
                  style={styles.dPadButton}
                  onPressIn={() => handleManualControl('forward')}
                  onPressOut={() => handleManualControl('stop')}
                >
                  <Text style={styles.dPadText}>▲</Text>
                </TouchableOpacity>
                <View style={styles.dPadEmpty} />
              </View>

              <View style={styles.dPadRow}>
                <TouchableOpacity
                  style={styles.dPadButton}
                  onPressIn={() => handleManualControl('left')}
                  onPressOut={() => handleManualControl('stop')}
                >
                  <Text style={styles.dPadText}>◄</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dPadButton, styles.dPadButtonStop]}
                  onPress={() => handleManualControl('stop')}
                >
                  <Text style={styles.dPadText}>■</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dPadButton}
                  onPressIn={() => handleManualControl('right')}
                  onPressOut={() => handleManualControl('stop')}
                >
                  <Text style={styles.dPadText}>►</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dPadRow}>
                <View style={styles.dPadEmpty} />
                <TouchableOpacity
                  style={styles.dPadButton}
                  onPressIn={() => handleManualControl('backward')}
                  onPressOut={() => handleManualControl('stop')}
                >
                  <Text style={styles.dPadText}>▼</Text>
                </TouchableOpacity>
                <View style={styles.dPadEmpty} />
              </View>
            </View>
          </View>
        )}

        {/* Auto Mode Waypoints */}
        {mode === 'auto' && (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Select Waypoint</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddModal(true)}
              >
                <Text style={styles.addButtonText}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {waypoints.map((wp) => (
              <View key={wp.id} style={styles.waypointRow}>
                <TouchableOpacity
                  style={[
                    styles.waypointItem,
                    selectedWaypoint?.id === wp.id && styles.waypointItemActive
                  ]}
                  onPress={() => setSelectedWaypoint(wp)}
                >
                  <View style={styles.waypointInfo}>
                    <Text style={styles.waypointName}>{wp.name}</Text>
                    <Text style={styles.waypointCoords}>
                      ({wp.x_coordinate}, {wp.y_coordinate})
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteWaypoint(wp.id)}
                >
                  <Text style={styles.deleteButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartAuto}
            >
              <Text style={styles.startButtonText}>Start Auto Drive</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stopButton}
              onPress={handleStop}
            >
              <Text style={styles.stopButtonText}>Stop</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Obstacle Info - FIXED VERSION */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Obstacle Detection</Text>
          <View style={styles.obstacleRow}>
            <Text style={styles.obstacleLabel}>Front:</Text>
            <Text style={styles.obstacleValue}>
              {telemetry?.distance_front != null ? safeNumber(telemetry.distance_front) : '--'} cm
            </Text>
          </View>
          <View style={styles.obstacleRow}>
            <Text style={styles.obstacleLabel}>Left:</Text>
            <Text style={styles.obstacleValue}>
              {telemetry?.distance_left != null ? safeNumber(telemetry.distance_left) : '--'} cm
            </Text>
          </View>
          <View style={styles.obstacleRow}>
            <Text style={styles.obstacleLabel}>Right:</Text>
            <Text style={styles.obstacleValue}>
              {telemetry?.distance_right != null ? safeNumber(telemetry.distance_right) : '--'} cm
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Add Waypoint Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Waypoint</Text>

            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor="#888"
              value={newWaypoint.name}
              onChangeText={(text) => setNewWaypoint({...newWaypoint, name: text})}
            />

            <View style={styles.coordInputs}>
              <TextInput
                style={[styles.input, {flex: 1}]}
                placeholder="X"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={newWaypoint.x}
                onChangeText={(text) => setNewWaypoint({...newWaypoint, x: text})}
              />
              <View style={{width: 10}} />
              <TextInput
                style={[styles.input, {flex: 1}]}
                placeholder="Y"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={newWaypoint.y}
                onChangeText={(text) => setNewWaypoint({...newWaypoint, y: text})}
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder="Description (optional)"
              placeholderTextColor="#888"
              value={newWaypoint.description}
              onChangeText={(text) => setNewWaypoint({...newWaypoint, description: text})}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleAddWaypoint}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Styles tetap sama...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  modeToggle: {
    flexDirection: 'row',
    margin: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 25,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  modeButtonActive: {
    backgroundColor: '#3b82f6',
  },
  modeText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  modeTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  panel: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  panelTitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 15,
    textTransform: 'uppercase',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  speedometer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  speedValue: {
    fontSize: 60,
    fontWeight: 'bold',
    color: 'white',
  },
  speedUnit: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 5,
  },
  statValue: {
    color: '#3b82f6',
    fontSize: 20,
    fontWeight: 'bold',
  },
  speedControl: {
    marginBottom: 20,
  },
  speedLabel: {
    color: '#888',
    fontSize: 14,
  },
  dPad: {
    alignSelf: 'center',
  },
  dPadRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  dPadButton: {
    width: 70,
    height: 70,
    backgroundColor: 'rgba(59,130,246,0.3)',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dPadButtonStop: {
    backgroundColor: 'rgba(239,68,68,0.3)',
    borderColor: '#ef4444',
  },
  dPadText: {
    color: 'white',
    fontSize: 24,
  },
  dPadEmpty: {
    width: 70,
    height: 70,
  },
  waypointRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  waypointItem: {
    flex: 1,
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 10,
    padding: 15,
  },
  waypointItemActive: {
    backgroundColor: '#3b82f6',
  },
  waypointInfo: {
    flex: 1,
  },
  waypointName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  waypointCoords: {
    color: '#888',
    fontSize: 14,
  },
  deleteButton: {
    width: 50,
    backgroundColor: 'rgba(239,68,68,0.3)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 28,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  stopButton: {
    backgroundColor: '#ef4444',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  stopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  obstacleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  obstacleLabel: {
    color: '#888',
    fontSize: 14,
  },
  obstacleValue: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    color: 'white',
    fontSize: 16,
  },
  coordInputs: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalButtonSave: {
    backgroundColor: '#3b82f6',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DashboardScreen;