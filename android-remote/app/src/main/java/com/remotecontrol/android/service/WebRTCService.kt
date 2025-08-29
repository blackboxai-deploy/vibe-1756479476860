package com.remotecontrol.android.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.remotecontrol.android.R
import org.webrtc.*
import org.webrtc.audio.AudioDeviceModule
import org.webrtc.audio.JavaAudioDeviceModule
import kotlinx.coroutines.*
import android.util.Log
import org.json.JSONObject

class WebRTCService : Service() {

    companion object {
        private const val TAG = "WebRTCService"
        private const val NOTIFICATION_ID = 2
        private const val CHANNEL_ID = "WebRTCServiceChannel"
    }

    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // WebRTC components
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var localVideoTrack: VideoTrack? = null
    private var localAudioTrack: AudioTrack? = null
    private var videoCapturer: VideoCapturer? = null
    private var videoSource: VideoSource? = null
    private var audioSource: AudioSource? = null
    private var dataChannel: DataChannel? = null

    // Callbacks
    private var onSignalCallback: ((JSONObject) -> Unit)? = null
    private var onDataChannelMessageCallback: ((String) -> Unit)? = null
    private var onConnectionStateCallback: ((PeerConnection.PeerConnectionState) -> Unit)? = null

    inner class LocalBinder : Binder() {
        fun getService(): WebRTCService = this@WebRTCService
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        initializeWebRTC()
        Log.d(TAG, "WebRTC Service created")
    }

    override fun onBind(intent: Intent?): IBinder = binder

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "WebRTC Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Manages WebRTC peer-to-peer connections"
                setShowBadge(false)
            }
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Android Remote Control")
            .setContentText("WebRTC connection active")
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setShowWhen(false)
            .build()
    }

    private fun initializeWebRTC() {
        serviceScope.launch {
            try {
                // Initialize PeerConnectionFactory
                val initializationOptions = PeerConnectionFactory.InitializationOptions.builder(this@WebRTCService)
                    .setEnableInternalTracer(true)
                    .createInitializationOptions()
                PeerConnectionFactory.initialize(initializationOptions)

                // Create PeerConnectionFactory
                val audioDeviceModule = JavaAudioDeviceModule.builder(this@WebRTCService)
                    .createAudioDeviceModule()

                val options = PeerConnectionFactory.Options()
                peerConnectionFactory = PeerConnectionFactory.builder()
                    .setOptions(options)
                    .setAudioDeviceModule(audioDeviceModule)
                    .createPeerConnectionFactory()

                Log.d(TAG, "WebRTC initialized successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to initialize WebRTC", e)
            }
        }
    }

    fun createPeerConnection(iceServers: List<String> = listOf("stun:stun.l.google.com:19302")) {
        val rtcConfig = PeerConnection.RTCConfiguration(
            iceServers.map { PeerConnection.IceServer.builder(it).createIceServer() }
        ).apply {
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
            rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
            tcpCandidatePolicy = PeerConnection.TcpCandidatePolicy.DISABLED
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
            keyType = PeerConnection.KeyType.ECDSA
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }

        val observer = object : PeerConnection.Observer {
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {
                Log.d(TAG, "Signaling state changed: $state")
            }

            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                Log.d(TAG, "ICE connection state changed: $state")
            }

            override fun onConnectionChange(state: PeerConnection.PeerConnectionState?) {
                Log.d(TAG, "Connection state changed: $state")
                state?.let { onConnectionStateCallback?.invoke(it) }
            }

            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {
                Log.d(TAG, "ICE gathering state changed: $state")
            }

            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate?.let {
                    Log.d(TAG, "New ICE candidate: ${it.sdp}")
                    val signal = JSONObject().apply {
                        put("type", "ice-candidate")
                        put("candidate", JSONObject().apply {
                            put("candidate", it.sdp)
                            put("sdpMid", it.sdpMid)
                            put("sdpMLineIndex", it.sdpMLineIndex)
                        })
                    }
                    onSignalCallback?.invoke(signal)
                }
            }

            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {
                Log.d(TAG, "ICE candidates removed")
            }

            override fun onAddStream(stream: MediaStream?) {
                Log.d(TAG, "Stream added")
            }

            override fun onRemoveStream(stream: MediaStream?) {
                Log.d(TAG, "Stream removed")
            }

            override fun onDataChannel(dataChannel: DataChannel?) {
                Log.d(TAG, "Data channel received")
                setupDataChannel(dataChannel)
            }

            override fun onRenegotiationNeeded() {
                Log.d(TAG, "Renegotiation needed")
            }

            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {
                Log.d(TAG, "Track added")
            }
        }

        peerConnection = peerConnectionFactory?.createPeerConnection(rtcConfig, observer)
        
        // Create data channel for receiving commands
        val dataChannelInit = DataChannel.Init().apply {
            ordered = true
        }
        dataChannel = peerConnection?.createDataChannel("commands", dataChannelInit)
        setupDataChannel(dataChannel)
    }

    private fun setupDataChannel(dataChannel: DataChannel?) {
        this.dataChannel = dataChannel
        dataChannel?.registerObserver(object : DataChannel.Observer {
            override fun onBufferedAmountChange(amount: Long) {}

            override fun onStateChange() {
                Log.d(TAG, "Data channel state: ${dataChannel.state()}")
            }

            override fun onMessage(buffer: DataChannel.Buffer?) {
                buffer?.let {
                    val data = ByteArray(it.data.remaining())
                    it.data.get(data)
                    val message = String(data, Charsets.UTF_8)
                    Log.d(TAG, "Data channel message: $message")
                    onDataChannelMessageCallback?.invoke(message)
                }
            }
        })
    }

    fun addVideoTrack(videoCapturer: VideoCapturer) {
        this.videoCapturer = videoCapturer
        
        videoSource = peerConnectionFactory?.createVideoSource(false)
        videoCapturer.initialize(
            SurfaceTextureHelper.create("CaptureThread", EglBase.create().eglBaseContext),
            this,
            videoSource?.capturerObserver
        )
        
        localVideoTrack = peerConnectionFactory?.createVideoTrack("video_track", videoSource)
        
        val videoSender = peerConnection?.addTrack(localVideoTrack, listOf("stream_id"))
        Log.d(TAG, "Video track added: ${videoSender != null}")
        
        // Start capturing
        videoCapturer.startCapture(1920, 1080, 30)
    }

    fun addAudioTrack() {
        audioSource = peerConnectionFactory?.createAudioSource(MediaConstraints())
        localAudioTrack = peerConnectionFactory?.createAudioTrack("audio_track", audioSource)
        
        val audioSender = peerConnection?.addTrack(localAudioTrack, listOf("stream_id"))
        Log.d(TAG, "Audio track added: ${audioSender != null}")
    }

    fun createOffer(callback: (SessionDescription) -> Unit) {
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "false"))
        }

        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription?) {
                sdp?.let {
                    peerConnection?.setLocalDescription(object : SdpObserver {
                        override fun onCreateSuccess(p0: SessionDescription?) {}
                        override fun onSetSuccess() {
                            Log.d(TAG, "Local description set successfully")
                            callback(it)
                        }
                        override fun onCreateFailure(error: String?) {
                            Log.e(TAG, "Failed to set local description: $error")
                        }
                        override fun onSetFailure(error: String?) {
                            Log.e(TAG, "Failed to set local description: $error")
                        }
                    }, it)
                }
            }

            override fun onSetSuccess() {}
            override fun onCreateFailure(error: String?) {
                Log.e(TAG, "Failed to create offer: $error")
            }
            override fun onSetFailure(error: String?) {}
        }, constraints)
    }

    fun createAnswer(callback: (SessionDescription) -> Unit) {
        val constraints = MediaConstraints()
        
        peerConnection?.createAnswer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription?) {
                sdp?.let {
                    peerConnection?.setLocalDescription(object : SdpObserver {
                        override fun onCreateSuccess(p0: SessionDescription?) {}
                        override fun onSetSuccess() {
                            Log.d(TAG, "Local description set successfully")
                            callback(it)
                        }
                        override fun onCreateFailure(error: String?) {
                            Log.e(TAG, "Failed to set local description: $error")
                        }
                        override fun onSetFailure(error: String?) {
                            Log.e(TAG, "Failed to set local description: $error")
                        }
                    }, it)
                }
            }

            override fun onSetSuccess() {}
            override fun onCreateFailure(error: String?) {
                Log.e(TAG, "Failed to create answer: $error")
            }
            override fun onSetFailure(error: String?) {}
        }, constraints)
    }

    fun setRemoteDescription(sdp: SessionDescription) {
        peerConnection?.setRemoteDescription(object : SdpObserver {
            override fun onCreateSuccess(p0: SessionDescription?) {}
            override fun onSetSuccess() {
                Log.d(TAG, "Remote description set successfully")
            }
            override fun onCreateFailure(error: String?) {}
            override fun onSetFailure(error: String?) {
                Log.e(TAG, "Failed to set remote description: $error")
            }
        }, sdp)
    }

    fun addIceCandidate(candidate: IceCandidate) {
        peerConnection?.addIceCandidate(candidate)
        Log.d(TAG, "ICE candidate added")
    }

    fun sendDataChannelMessage(message: String): Boolean {
        return try {
            if (dataChannel?.state() == DataChannel.State.OPEN) {
                val buffer = DataChannel.Buffer(
                    java.nio.ByteBuffer.wrap(message.toByteArray(Charsets.UTF_8)),
                    false
                )
                dataChannel?.send(buffer)
                true
            } else {
                Log.w(TAG, "Data channel not open: ${dataChannel?.state()}")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send data channel message", e)
            false
        }
    }

    // Callback setters
    fun setOnSignalCallback(callback: (JSONObject) -> Unit) {
        onSignalCallback = callback
    }

    fun setOnDataChannelMessageCallback(callback: (String) -> Unit) {
        onDataChannelMessageCallback = callback
    }

    fun setOnConnectionStateCallback(callback: (PeerConnection.PeerConnectionState) -> Unit) {
        onConnectionStateCallback = callback
    }

    fun getConnectionState(): PeerConnection.PeerConnectionState? {
        return peerConnection?.connectionState()
    }

    fun closeConnection() {
        videoCapturer?.stopCapture()
        videoCapturer?.dispose()
        
        localVideoTrack?.dispose()
        localAudioTrack?.dispose()
        videoSource?.dispose()
        audioSource?.dispose()
        
        dataChannel?.close()
        peerConnection?.close()
        
        videoCapturer = null
        localVideoTrack = null
        localAudioTrack = null
        videoSource = null
        audioSource = null
        dataChannel = null
        peerConnection = null
        
        Log.d(TAG, "WebRTC connection closed")
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        closeConnection()
        peerConnectionFactory?.dispose()
        Log.d(TAG, "WebRTC Service destroyed")
    }
}