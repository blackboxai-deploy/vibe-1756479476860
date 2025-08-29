'use client';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  deviceId: string;
  onStreamReceived: (stream: MediaStream) => void;
  onDataChannelMessage: (message: any) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onSignal: (signal: any) => void;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private config: WebRTCConfig;


  constructor(config: WebRTCConfig) {
    this.config = config;
    this.initializePeerConnection();
  }

  private initializePeerConnection() {
    const configuration: RTCConfiguration = {
      iceServers: this.config.iceServers.length > 0 ? this.config.iceServers : [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    // Handle incoming streams
    this.peerConnection.ontrack = (event) => {
      console.log('Received remote stream');
      if (event.streams && event.streams[0]) {
        this.config.onStreamReceived(event.streams[0]);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate');
        this.config.onSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON()
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('WebRTC connection state:', state);
      if (state) {
        this.config.onConnectionStateChange(state);
      }
    };

    // Handle data channel
    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      this.setupDataChannel(channel);
    };

    // Setup ICE connection state monitoring
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
    };
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;

    channel.onopen = () => {
      console.log('Data channel opened');
    };

    channel.onclose = () => {
      console.log('Data channel closed');
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.config.onDataChannelMessage(message);
      } catch (error) {
        console.error('Error parsing data channel message:', error);
      }
    };
  }

  // Create offer (called by web client)
  async createOffer(): Promise<void> {
    if (!this.peerConnection) return;



    // Create data channel for sending commands
    this.dataChannel = this.peerConnection.createDataChannel('commands', {
      ordered: true
    });
    this.setupDataChannel(this.dataChannel);

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });

      await this.peerConnection.setLocalDescription(offer);

      this.config.onSignal({
        type: 'offer',
        sdp: offer.sdp
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  // Handle answer (from Android device)
  async handleAnswer(answerSdp: string): Promise<void> {
    if (!this.peerConnection) return;

    try {
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp
      });

      await this.peerConnection.setRemoteDescription(answer);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  // Handle offer (from Android device)
  async handleOffer(offerSdp: string): Promise<void> {
    if (!this.peerConnection) return;

    try {
      const offer = new RTCSessionDescription({
        type: 'offer',
        sdp: offerSdp
      });

      await this.peerConnection.setRemoteDescription(offer);

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.config.onSignal({
        type: 'answer',
        sdp: answer.sdp
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  // Handle ICE candidate
  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  // Send data through data channel
  sendData(data: any): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(data));
        return true;
      } catch (error) {
        console.error('Error sending data:', error);
      }
    }
    return false;
  }

  // Send touch event
  sendTouchEvent(x: number, y: number, action: 'down' | 'move' | 'up', pressure: number = 1.0) {
    return this.sendData({
      type: 'touch',
      x,
      y,
      action,
      pressure,
      timestamp: Date.now()
    });
  }

  // Send device command
  sendDeviceCommand(command: string, value?: any) {
    return this.sendData({
      type: 'command',
      command,
      value,
      timestamp: Date.now()
    });
  }

  // Send key event
  sendKeyEvent(keyCode: number, action: 'down' | 'up') {
    return this.sendData({
      type: 'key',
      keyCode,
      action,
      timestamp: Date.now()
    });
  }

  // Get connection statistics
  async getStats(): Promise<RTCStatsReport | null> {
    if (!this.peerConnection) return null;
    return await this.peerConnection.getStats();
  }

  // Get current connection state
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  // Check if data channel is open
  isDataChannelOpen(): boolean {
    return this.dataChannel?.readyState === 'open';
  }

  // Close connection
  close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  // Restart ICE
  async restartIce(): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.restartIce();
    } catch (error) {
      console.error('Error restarting ICE:', error);
    }
  }
}