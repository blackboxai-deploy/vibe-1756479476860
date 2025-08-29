'use client';

// Mock Socket.IO client for build compatibility
interface Socket {
  id?: string;
  connected: boolean;
  emit(event: string, ...args: any[]): void;
  on(event: string, callback: (...args: any[]) => void): void;
  once(event: string, callback: (...args: any[]) => void): void;
  disconnect(): void;
}

// Mock io function
function io(url: string, options?: any): Socket {
  return {
    id: 'mock-socket-id',
    connected: false,
    emit: () => {},
    on: () => {},
    once: () => {},
    disconnect: () => {}
  };
}

export interface DeviceInfo {
  id: string;
  name: string;
  model: string;
  androidVersion: string;
  screenResolution: string;
  isConnected: boolean;
  lastSeen: Date;
}

export interface TouchEvent {
  type: 'touch' | 'move' | 'release' | 'swipe' | 'pinch';
  x: number;
  y: number;
  pressure?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  scale?: number;
}

export interface DeviceCommand {
  type: 'volume_up' | 'volume_down' | 'brightness_up' | 'brightness_down' | 'home' | 'back' | 'recent' | 'power' | 'screenshot';
  value?: number;
}

export class WebSocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private url: string = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000') {
    this.connect();
  }

  private connect() {
    this.socket = io(this.url, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.socket?.disconnect();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      this.reconnectAttempts = 0;
    });
  }

  // Device Management
  registerDevice(deviceInfo: Omit<DeviceInfo, 'id' | 'isConnected' | 'lastSeen'>) {
    this.socket?.emit('register_device', deviceInfo);
  }

  getDevices(): Promise<DeviceInfo[]> {
    return new Promise((resolve) => {
      this.socket?.emit('get_devices');
      this.socket?.once('devices_list', resolve);
    });
  }

  connectToDevice(deviceId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.socket?.emit('connect_device', deviceId);
      this.socket?.once('device_connected', resolve);
    });
  }

  disconnectFromDevice(deviceId: string) {
    this.socket?.emit('disconnect_device', deviceId);
  }

  // Touch Events
  sendTouchEvent(deviceId: string, touchEvent: TouchEvent) {
    this.socket?.emit('touch_event', { deviceId, ...touchEvent });
  }

  // Device Commands
  sendDeviceCommand(deviceId: string, command: DeviceCommand) {
    this.socket?.emit('device_command', { deviceId, ...command });
  }

  // File Transfer
  sendFile(deviceId: string, file: File, onProgress?: (progress: number) => void) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const chunk_size = 64 * 1024; // 64KB chunks
      const chunks = Math.ceil(arrayBuffer.byteLength / chunk_size);
      
      for (let i = 0; i < chunks; i++) {
        const start = i * chunk_size;
        const end = Math.min(start + chunk_size, arrayBuffer.byteLength);
        const chunk = arrayBuffer.slice(start, end);
        
        this.socket?.emit('file_chunk', {
          deviceId,
          fileName: file.name,
          fileSize: file.size,
          chunkIndex: i,
          totalChunks: chunks,
          chunk: Array.from(new Uint8Array(chunk)),
        });

        if (onProgress) {
          onProgress((i + 1) / chunks * 100);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // Event Listeners
  onDeviceStatusChange(callback: (deviceId: string, status: boolean) => void) {
    this.socket?.on('device_status_changed', callback);
  }

  onScreenFrame(callback: (deviceId: string, frame: ArrayBuffer) => void) {
    this.socket?.on('screen_frame', callback);
  }

  onDeviceResponse(callback: (deviceId: string, response: any) => void) {
    this.socket?.on('device_response', callback);
  }

  onFileTransferComplete(callback: (deviceId: string, fileName: string, success: boolean) => void) {
    this.socket?.on('file_transfer_complete', callback);
  }

  // WebRTC Signaling
  sendSignal(deviceId: string, signal: any) {
    this.socket?.emit('webrtc_signal', { deviceId, signal });
  }

  onSignal(callback: (deviceId: string, signal: any) => void) {
    this.socket?.on('webrtc_signal', callback);
  }

  // Cleanup
  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}