import { useEffect, useRef, useState, useCallback } from 'react';
import { CONFIG } from '../config';

export const useWebSocket = () => {
  const [telemetry, setTelemetry] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const isIntentionallyClosed = useRef(false);

  const connectWebSocket = useCallback(() => {
    // Prevent multiple connection attempts
    if (ws.current?.readyState === WebSocket.CONNECTING || 
        ws.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connecting/connected');
      return;
    }

    // Stop if too many failed attempts
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    try {
      console.log(`Connecting to WebSocket... (attempt ${reconnectAttempts.current + 1})`);
      
      // Clear existing connection
      if (ws.current) {
        ws.current.onopen = null;
        ws.current.onmessage = null;
        ws.current.onerror = null;
        ws.current.onclose = null;
        ws.current.close();
      }

      ws.current = new WebSocket(CONFIG.WS_URL);

      ws.current.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        setIsConnected(true);
        reconnectAttempts.current = 0; // Reset on successful connection
        isIntentionallyClosed.current = false;
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'telemetry') {
            setTelemetry(data.data);
          }
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        // Don't immediately reconnect on error, wait for onclose
      };

      ws.current.onclose = (event) => {
        console.log(`🔌 WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
        setIsConnected(false);
        
        // Only reconnect if not intentionally closed
        if (!isIntentionallyClosed.current) {
          // Clear any existing timeout
          if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
          }

          reconnectAttempts.current += 1;
          
          // Exponential backoff: 3s, 6s, 12s, 24s, 48s
          const delay = Math.min(3000 * Math.pow(2, reconnectAttempts.current - 1), 48000);
          
          console.log(`Reconnecting in ${delay/1000}s... (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimeout.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        }
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      reconnectAttempts.current += 1;
      
      // Retry with delay
      const delay = 5000;
      reconnectTimeout.current = setTimeout(() => {
        connectWebSocket();
      }, delay);
    }
  }, []);

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      console.log('Cleaning up WebSocket connection');
      isIntentionallyClosed.current = true;
      
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      
      if (ws.current) {
        ws.current.onopen = null;
        ws.current.onmessage = null;
        ws.current.onerror = null;
        ws.current.onclose = null;
        ws.current.close(1000, 'Component unmounted');
      }
    };
  }, [connectWebSocket]);

  const sendControl = useCallback((command, data) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify({
          type: 'control',
          payload: { command, ...data }
        }));
        console.log('Control sent:', command, data);
      } catch (error) {
        console.error('Failed to send control:', error);
      }
    } else {
      console.warn('WebSocket not connected, cannot send control');
    }
  }, []);

  return { telemetry, isConnected, sendControl };
};