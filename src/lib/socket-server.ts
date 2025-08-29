import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

// Global variable to store the Socket.IO server instance
let io: SocketIOServer | null = null;

// Device storage (in production, use a database)
const connectedDevices = new Map<string, any>();
const deviceSessions = new Map<string, string>(); // deviceId -> socketId

export function initializeSocketServer(httpServer: HTTPServer) {
  if (!io) {
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      path: '/socket.io/',
      transports: ['websocket', 'polling']
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Register Android device
      socket.on('register_device', (deviceInfo) => {
        const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const device = {
          id: deviceId,
          socketId: socket.id,
          ...deviceInfo,
          isConnected: true,
          lastSeen: new Date(),
          connectedClients: new Set<string>()
        };
        
        connectedDevices.set(deviceId, device);
        deviceSessions.set(deviceId, socket.id);
        
        socket.join(`device_${deviceId}`);
        socket.emit('device_registered', { deviceId, success: true });
        
        // Broadcast device list update
        io?.emit('devices_list_updated', Array.from(connectedDevices.values()));
        
        console.log('Device registered:', deviceId, deviceInfo);
      });

      // Get devices list
      socket.on('get_devices', () => {
        const devices = Array.from(connectedDevices.values()).map(device => ({
          id: device.id,
          name: device.name,
          model: device.model,
          androidVersion: device.androidVersion,
          screenResolution: device.screenResolution,
          isConnected: device.isConnected,
          lastSeen: device.lastSeen
        }));
        
        socket.emit('devices_list', devices);
      });

      // Connect to device
      socket.on('connect_device', (deviceId) => {
        const device = connectedDevices.get(deviceId);
        if (device && device.isConnected) {
          device.connectedClients.add(socket.id);
          socket.join(`device_${deviceId}`);
          socket.join(`controller_${deviceId}`);
          
          socket.emit('device_connected', { deviceId, success: true });
          
          // Notify Android device of new controller
          io?.to(device.socketId).emit('controller_connected', {
            controllerId: socket.id,
            deviceId
          });
          
          console.log('Controller connected to device:', deviceId);
        } else {
          socket.emit('device_connected', { deviceId, success: false, error: 'Device not available' });
        }
      });

      // WebRTC signaling
      socket.on('webrtc_signal', (data) => {
        const { deviceId, signal } = data;
        const device = connectedDevices.get(deviceId);
        
        if (device) {
          if (device.socketId === socket.id) {
            // Signal from Android device to controllers
            io?.to(`controller_${deviceId}`).emit('webrtc_signal', {
              deviceId,
              signal,
              from: 'device'
            });
          } else if (device.connectedClients.has(socket.id)) {
            // Signal from controller to Android device
            io?.to(device.socketId).emit('webrtc_signal', {
              controllerId: socket.id,
              signal,
              from: 'controller'
            });
          }
        }
      });

      // Touch events
      socket.on('touch_event', (data) => {
        const { deviceId, ...touchEvent } = data;
        const device = connectedDevices.get(deviceId);
        
        if (device && device.connectedClients.has(socket.id)) {
          io?.to(device.socketId).emit('touch_event', touchEvent);
        }
      });

      // Device commands
      socket.on('device_command', (data) => {
        const { deviceId, ...command } = data;
        const device = connectedDevices.get(deviceId);
        
        if (device && device.connectedClients.has(socket.id)) {
          io?.to(device.socketId).emit('device_command', command);
        }
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log('Client disconnected:', socket.id, reason);
        
        // Remove from all devices
        for (const [deviceId, device] of connectedDevices.entries()) {
          if (device.socketId === socket.id) {
            // Android device disconnected
            device.isConnected = false;
            device.lastSeen = new Date();
            
            // Notify all controllers
            io?.to(`controller_${deviceId}`).emit('device_disconnected', { deviceId });
            
            console.log('Android device disconnected:', deviceId);
          } else if (device.connectedClients.has(socket.id)) {
            // Controller disconnected
            device.connectedClients.delete(socket.id);
            
            // Notify Android device
            io?.to(device.socketId).emit('controller_disconnected', {
              controllerId: socket.id,
              deviceId
            });
            
            console.log('Controller disconnected from device:', deviceId);
          }
        }
        
        // Broadcast updated device list
        io?.emit('devices_list_updated', Array.from(connectedDevices.values()));
      });
    });

    // Cleanup disconnected devices periodically
    setInterval(() => {
      const now = new Date();
      for (const [deviceId, device] of connectedDevices.entries()) {
        const timeSinceLastSeen = now.getTime() - device.lastSeen.getTime();
        if (timeSinceLastSeen > 30000) { // 30 seconds timeout
          device.isConnected = false;
          if (timeSinceLastSeen > 300000) { // 5 minutes - remove completely
            connectedDevices.delete(deviceId);
            deviceSessions.delete(deviceId);
          }
        }
      }
    }, 10000); // Check every 10 seconds
  }

  return io;
}

export function getSocketServer() {
  return io;
}