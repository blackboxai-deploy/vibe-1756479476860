'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DeviceList from '@/components/DeviceList';
import DeviceScreen from '@/components/DeviceScreen';
import ControlPanel from '@/components/ControlPanel';
import FileTransfer from '@/components/FileTransfer';
import { WebSocketManager, DeviceInfo } from '@/lib/websocket';

export default function Home() {
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [wsManager, setWsManager] = useState<WebSocketManager | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocketManager();
    setWsManager(ws);

    // Listen for connection status changes
    ws.onDeviceStatusChange((deviceId, connected) => {
      if (selectedDevice && selectedDevice.id === deviceId) {
        setIsConnected(connected);
        if (!connected) {
          // Device disconnected, go back to device list
          setSelectedDevice(null);
        }
      }
    });

    return () => {
      ws.disconnect();
    };
  }, [selectedDevice]);

  const handleDeviceSelect = (device: DeviceInfo) => {
    setSelectedDevice(device);
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    if (wsManager && selectedDevice) {
      wsManager.disconnectFromDevice(selectedDevice.id);
    }
    setSelectedDevice(null);
    setIsConnected(false);
  };

  if (!selectedDevice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="container mx-auto py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Android Remote Control
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Control your Android devices remotely through your web browser. 
              Real-time screen mirroring, touch control, and file transfer.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl">📱</span>
                </div>
                <CardTitle className="text-lg">Real-time Screen Mirroring</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  See your Android screen in real-time with low latency WebRTC streaming
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl">👆</span>
                </div>
                <CardTitle className="text-lg">Touch Control</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Full touch control including taps, swipes, pinch-to-zoom, and multi-touch
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl">📁</span>
                </div>
                <CardTitle className="text-lg">File Transfer</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Transfer files between your computer and Android device seamlessly
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Setup Instructions */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-xl">Getting Started</CardTitle>
              <CardDescription>
                Follow these steps to connect your Android device
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto bg-blue-600 text-white rounded-full flex items-center justify-center mb-3 font-bold">
                    1
                  </div>
                  <h3 className="font-semibold mb-2">Download APK</h3>
                  <p className="text-sm text-gray-600">
                    Download and install the Android Remote Control app on your device
                  </p>
                  <Button 
                    className="mt-3" 
                    variant="outline"
                    onClick={() => {
                      // This would download the APK file
                      alert('APK download will be available after Android app is built');
                    }}
                  >
                    Download APK
                  </Button>
                </div>
                
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto bg-blue-600 text-white rounded-full flex items-center justify-center mb-3 font-bold">
                    2
                  </div>
                  <h3 className="font-semibold mb-2">Grant Permissions</h3>
                  <p className="text-sm text-gray-600">
                    Allow screen recording and accessibility permissions in the app
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto bg-blue-600 text-white rounded-full flex items-center justify-center mb-3 font-bold">
                    3
                  </div>
                  <h3 className="font-semibold mb-2">Connect</h3>
                  <p className="text-sm text-gray-600">
                    Your device will appear in the list below once connected
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Device List */}
          {wsManager && (
            <DeviceList
              onDeviceSelect={handleDeviceSelect}
              selectedDeviceId={selectedDevice?.id || undefined}
            />
          )}

          {/* Footer */}
          <div className="text-center mt-12 text-gray-500">
            <p className="text-sm">
              Secure WebRTC connection • No data stored on servers • Open source
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Remote Control - {selectedDevice.name}
            </h1>
            <p className="text-gray-600">
              {selectedDevice.model} • Android {selectedDevice.androidVersion}
            </p>
          </div>
          <Button onClick={handleDisconnect} variant="outline">
            Back to Devices
          </Button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Screen Display (takes most space) */}
          <div className="xl:col-span-3">
            {wsManager && (
              <DeviceScreen
                device={selectedDevice}
                wsManager={wsManager}
                onDisconnect={handleDisconnect}
              />
            )}
          </div>

          {/* Control Panels */}
          <div className="space-y-6">
            <Tabs defaultValue="controls" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="controls">Controls</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
              </TabsList>
              
              <TabsContent value="controls" className="mt-4">
                {wsManager && (
                  <ControlPanel
                    deviceId={selectedDevice.id}
                    wsManager={wsManager}
                    isConnected={isConnected}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="files" className="mt-4">
                {wsManager && (
                  <FileTransfer
                    deviceId={selectedDevice.id}
                    wsManager={wsManager}
                    isConnected={isConnected}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Connection Status */}
        <div className="fixed bottom-4 right-4">
          <div className={`px-4 py-2 rounded-full text-sm font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}