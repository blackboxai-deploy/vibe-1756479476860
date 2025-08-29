'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WebRTCManager, WebRTCConfig } from '@/lib/webrtc';
import { WebSocketManager, DeviceInfo, TouchEvent } from '@/lib/websocket';

interface DeviceScreenProps {
  device: DeviceInfo;
  wsManager: WebSocketManager;
  onDisconnect: () => void;
}

interface TouchPoint {
  x: number;
  y: number;
  pressure: number;
}

export default function DeviceScreen({ device, wsManager, onDisconnect }: DeviceScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webrtcManager, setWebrtcManager] = useState<WebRTCManager | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);


  // Touch handling
  const [activeTouches, setActiveTouches] = useState<Map<number, TouchPoint>>(new Map());
  const [isDragging, setIsDragging] = useState(false);

  // Initialize WebRTC connection
  useEffect(() => {
    const config: WebRTCConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      deviceId: device.id,
      onStreamReceived: (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      },
      onDataChannelMessage: (message) => {
        console.log('Received data channel message:', message);
      },
      onConnectionStateChange: (state) => {
        setConnectionState(state);
        if (state === 'failed' || state === 'disconnected') {
          // Try to reconnect
          setTimeout(() => {
            webrtcManager?.restartIce();
          }, 2000);
        }
      },
      onSignal: (signal) => {
        wsManager.sendSignal(device.id, signal);
      }
    };

    const rtcManager = new WebRTCManager(config);
    setWebrtcManager(rtcManager);

    // Listen for WebRTC signals from device
    wsManager.onSignal((deviceId, signal) => {
      if (deviceId === device.id) {
        if (signal.type === 'offer') {
          rtcManager.handleOffer(signal.sdp);
        } else if (signal.type === 'answer') {
          rtcManager.handleAnswer(signal.sdp);
        } else if (signal.type === 'ice-candidate') {
          rtcManager.handleIceCandidate(signal.candidate);
        }
      }
    });

    // Create offer to start connection
    rtcManager.createOffer();

    return () => {
      rtcManager.close();
    };
  }, [device.id, wsManager]);

  // Screen recording functionality
  const startRecording = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `screen-recording-${device.name}-${new Date().toISOString()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setRecordedChunks([]);
      };

      recorder.start(1000); // Record in 1-second chunks
      setMediaRecorder(recorder);
      setIsRecording(true);
    }
  }, [device.name, recordedChunks]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  }, [mediaRecorder]);

  // Touch event handlers
  const getRelativeCoordinates = (event: React.MouseEvent | React.TouchEvent, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    if (!canvasRef.current) return;

    const coords = getRelativeCoordinates(event, canvasRef.current);
    const touchEvent: TouchEvent = {
      type: 'touch',
      x: coords.x,
      y: coords.y,
      pressure: 1.0
    };

    wsManager.sendTouchEvent(device.id, touchEvent);
    setIsDragging(true);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    event.preventDefault();
    if (!isDragging || !canvasRef.current) return;

    const coords = getRelativeCoordinates(event, canvasRef.current);
    const touchEvent: TouchEvent = {
      type: 'move',
      x: coords.x,
      y: coords.y,
      pressure: 1.0
    };

    wsManager.sendTouchEvent(device.id, touchEvent);
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    event.preventDefault();
    if (!canvasRef.current) return;

    const coords = getRelativeCoordinates(event, canvasRef.current);
    const touchEvent: TouchEvent = {
      type: 'release',
      x: coords.x,
      y: coords.y,
      pressure: 0
    };

    wsManager.sendTouchEvent(device.id, touchEvent);
    setIsDragging(false);
  };

  // Touch event handlers for mobile
  const handleTouchStart = (event: React.TouchEvent) => {
    event.preventDefault();
    if (!canvasRef.current) return;

    Array.from(event.touches).forEach((touch: Touch) => {
      const coords = getRelativeCoordinates(event, canvasRef.current!);
      const touchEvent: TouchEvent = {
        type: 'touch',
        x: coords.x,
        y: coords.y,
        pressure: touch.force || 1.0
      };

      wsManager.sendTouchEvent(device.id, touchEvent);
      
      setActiveTouches(prev => new Map(prev).set(touch.identifier, {
        x: coords.x,
        y: coords.y,
        pressure: touch.force || 1.0
      }));
    });
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    event.preventDefault();
    if (!canvasRef.current) return;

    Array.from(event.touches).forEach((touch: Touch) => {
      const coords = getRelativeCoordinates(event, canvasRef.current!);
      const touchEvent: TouchEvent = {
        type: 'move',
        x: coords.x,
        y: coords.y,
        pressure: touch.force || 1.0
      };

      wsManager.sendTouchEvent(device.id, touchEvent);
      
      setActiveTouches(prev => {
        const newTouches = new Map(prev);
        newTouches.set(touch.identifier, {
          x: coords.x,
          y: coords.y,
          pressure: touch.force || 1.0
        });
        return newTouches;
      });
    });
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    event.preventDefault();
    
    Array.from(event.changedTouches).forEach((touch: Touch) => {
      const coords = activeTouches.get(touch.identifier);
      if (coords) {
        const touchEvent: TouchEvent = {
          type: 'release',
          x: coords.x,
          y: coords.y,
          pressure: 0
        };

        wsManager.sendTouchEvent(device.id, touchEvent);
        
        setActiveTouches(prev => {
          const newTouches = new Map(prev);
          newTouches.delete(touch.identifier);
          return newTouches;
        });
      }
    });
  };

  // Connection status badge
  const getConnectionBadge = () => {
    switch (connectionState) {
      case 'connected':
        return <Badge className="bg-green-500 text-white">Connected</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500 text-white">Connecting</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">Disconnected</Badge>;
      case 'failed':
        return <Badge variant="destructive">Connection Failed</Badge>;
      default:
        return <Badge variant="outline">Initializing</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-gray-900">
              Remote Control - {device.name}
            </CardTitle>
            <div className="flex items-center space-x-4 mt-2">
              {getConnectionBadge()}
              <span className="text-sm text-gray-600">{device.model}</span>
              <span className="text-sm text-gray-600">{device.screenResolution}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {connectionState === 'connected' && (
              <>
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                >
                  {isRecording ? "Stop Recording" : "Start Recording"}
                </Button>
                {isRecording && (
                  <div className="flex items-center space-x-1 text-red-600">
                    <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">REC</span>
                  </div>
                )}
              </>
            )}
            <Button onClick={onDisconnect} variant="outline" size="sm">
              Disconnect
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="relative">
          {/* Video stream */}
          <video
            ref={videoRef}
            className="w-full max-w-full h-auto bg-black rounded-lg shadow-lg"
            autoPlay
            playsInline
            muted
            style={{ maxHeight: '70vh' }}
          />
          
          {/* Touch overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-pointer"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ touchAction: 'none' }}
          />
          
          {/* Connection overlay */}
          {connectionState !== 'connected' && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
              <div className="text-center text-white">
                <div className="w-16 h-16 mx-auto mb-4 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                <h3 className="text-lg font-semibold mb-2">
                  {connectionState === 'connecting' ? 'Connecting to device...' : 
                   connectionState === 'failed' ? 'Connection failed' : 
                   'Initializing connection...'}
                </h3>
                <p className="text-sm opacity-75">
                  {connectionState === 'failed' ? 'Please check your device and try again' : 
                   'This may take a few seconds'}
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Touch indicators */}
        {activeTouches.size > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Active touches: {activeTouches.size}
          </div>
        )}
      </CardContent>
    </Card>
  );
}