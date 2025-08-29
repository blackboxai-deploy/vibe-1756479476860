'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { WebSocketManager, DeviceInfo } from '@/lib/websocket';

interface DeviceListProps {
  onDeviceSelect: (device: DeviceInfo) => void;
  selectedDeviceId?: string;
}

export default function DeviceList({ onDeviceSelect, selectedDeviceId }: DeviceListProps) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsManager, setWsManager] = useState<WebSocketManager | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocketManager();
    setWsManager(ws);

    // Load devices
    ws.getDevices().then((deviceList) => {
      setDevices(deviceList);
      setLoading(false);
    });

    // Listen for device updates
    ws.onDeviceStatusChange((deviceId, isConnected) => {
      setDevices(prev => prev.map(device => 
        device.id === deviceId 
          ? { ...device, isConnected, lastSeen: new Date() }
          : device
      ));
    });

    return () => {
      ws.disconnect();
    };
  }, []);

  const handleConnect = async (device: DeviceInfo) => {
    if (!wsManager) return;
    
    setConnecting(device.id);
    try {
      const success = await wsManager.connectToDevice(device.id);
      if (success) {
        onDeviceSelect(device);
      }
    } catch (error) {
      console.error('Failed to connect to device:', error);
    } finally {
      setConnecting(null);
    }
  };

  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading Devices...</span>
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-900">Connected Devices</CardTitle>
        <CardDescription>
          {devices.length} device{devices.length !== 1 ? 's' : ''} found. Select a device to start remote control.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Devices Found</h3>
            <p className="text-gray-600 mb-4">
              Install the Android Remote Control app on your device and ensure it's connected to the same network.
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              className="mx-auto"
            >
              Refresh
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {devices.map((device, index) => (
              <div key={device.id}>
                <div className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  selectedDeviceId === device.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : device.isConnected 
                      ? 'border-green-200 bg-green-50 hover:border-green-300' 
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                            {device.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{device.name}</h3>
                          <p className="text-sm text-gray-600">{device.model}</p>
                        </div>
                        <div className="flex space-x-2">
                          <Badge variant={device.isConnected ? "default" : "secondary"}>
                            {device.isConnected ? "Online" : "Offline"}
                          </Badge>
                          {selectedDeviceId === device.id && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800">
                              Connected
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Android:</span> {device.androidVersion}
                        </div>
                        <div>
                          <span className="font-medium">Resolution:</span> {device.screenResolution}
                        </div>
                        <div>
                          <span className="font-medium">Last seen:</span> {formatLastSeen(device.lastSeen)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0 ml-4">
                      {device.isConnected ? (
                        <Button
                          onClick={() => handleConnect(device)}
                          disabled={connecting === device.id || selectedDeviceId === device.id}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {connecting === device.id ? (
                            <div className="flex items-center space-x-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Connecting...</span>
                            </div>
                          ) : selectedDeviceId === device.id ? (
                            "Connected"
                          ) : (
                            "Connect"
                          )}
                        </Button>
                      ) : (
                        <Button disabled variant="outline">
                          Device Offline
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                {index < devices.length - 1 && <Separator className="my-4" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}