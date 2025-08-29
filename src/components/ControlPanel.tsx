'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { WebSocketManager, DeviceCommand } from '@/lib/websocket';

interface ControlPanelProps {
  deviceId: string;
  wsManager: WebSocketManager;
  isConnected: boolean;
}

export default function ControlPanel({ deviceId, wsManager, isConnected }: ControlPanelProps) {
  const [volume, setVolume] = useState([50]);
  const [brightness, setBrightness] = useState([50]);

  const sendCommand = (command: DeviceCommand) => {
    if (isConnected) {
      wsManager.sendDeviceCommand(deviceId, command);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value);
    sendCommand({ type: 'volume_up', value: value[0] });
  };

  const handleBrightnessChange = (value: number[]) => {
    setBrightness(value);
    sendCommand({ type: 'brightness_up', value: value[0] });
  };

  const navigationButtons = [
    { label: 'Home', command: 'home', icon: '🏠' },
    { label: 'Back', command: 'back', icon: '←' },
    { label: 'Recent', command: 'recent', icon: '☰' },
    { label: 'Power', command: 'power', icon: '⏻' }
  ];

  const quickActions = [
    { label: 'Volume Up', command: 'volume_up', icon: '🔊' },
    { label: 'Volume Down', command: 'volume_down', icon: '🔉' },
    { label: 'Screenshot', command: 'screenshot', icon: '📷' }
  ];

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Device Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Navigation Buttons */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Navigation</h3>
          <div className="grid grid-cols-2 gap-2">
            {navigationButtons.map((button) => (
              <Button
                key={button.command}
                onClick={() => sendCommand({ type: button.command as any })}
                disabled={!isConnected}
                variant="outline"
                className="h-12 flex flex-col items-center justify-center text-xs"
              >
                <span className="text-lg mb-1">{button.icon}</span>
                <span>{button.label}</span>
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Volume Control */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Volume</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 w-8">🔈</span>
              <Slider
                value={volume}
                onValueChange={handleVolumeChange}
                disabled={!isConnected}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-gray-500 w-8">🔊</span>
            </div>
            <div className="text-center text-xs text-gray-500">
              {volume[0]}%
            </div>
          </div>
        </div>

        <Separator />

        {/* Brightness Control */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Brightness</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 w-8">🌑</span>
              <Slider
                value={brightness}
                onValueChange={handleBrightnessChange}
                disabled={!isConnected}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-gray-500 w-8">🌞</span>
            </div>
            <div className="text-center text-xs text-gray-500">
              {brightness[0]}%
            </div>
          </div>
        </div>

        <Separator />

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <Button
                key={action.command}
                onClick={() => sendCommand({ type: action.command as any })}
                disabled={!isConnected}
                variant="outline"
                className="w-full flex items-center justify-start space-x-2 h-10"
              >
                <span className="text-lg">{action.icon}</span>
                <span className="text-sm">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Connection Status */}
        <div className="text-center">
          <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        {/* Advanced Controls */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Advanced</h3>
          <div className="space-y-2">
            <Button
              onClick={() => {
                // Simulate swipe up gesture
                wsManager.sendTouchEvent(deviceId, {
                  type: 'swipe',
                  x: 0.5,
                  y: 0.8,
                  direction: 'up',
                  duration: 300
                });
              }}
              disabled={!isConnected}
              variant="outline"
              className="w-full text-sm"
            >
              Swipe Up (App Drawer)
            </Button>
            
            <Button
              onClick={() => {
                // Simulate swipe down gesture
                wsManager.sendTouchEvent(deviceId, {
                  type: 'swipe',
                  x: 0.5,
                  y: 0.2,
                  direction: 'down',
                  duration: 300
                });
              }}
              disabled={!isConnected}
              variant="outline"
              className="w-full text-sm"
            >
              Swipe Down (Notifications)
            </Button>

            <Button
              onClick={() => {
                // Simulate pinch to zoom out
                wsManager.sendTouchEvent(deviceId, {
                  type: 'pinch',
                  x: 0.5,
                  y: 0.5,
                  scale: 0.5
                });
              }}
              disabled={!isConnected}
              variant="outline"
              className="w-full text-sm"
            >
              Pinch Zoom Out
            </Button>

            <Button
              onClick={() => {
                // Simulate pinch to zoom in
                wsManager.sendTouchEvent(deviceId, {
                  type: 'pinch',
                  x: 0.5,
                  y: 0.5,
                  scale: 2.0
                });
              }}
              disabled={!isConnected}
              variant="outline"
              className="w-full text-sm"
            >
              Pinch Zoom In
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}