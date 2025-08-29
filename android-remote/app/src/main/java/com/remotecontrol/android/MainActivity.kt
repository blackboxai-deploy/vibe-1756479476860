package com.remotecontrol.android

import android.Manifest
import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.provider.Settings
import android.text.TextUtils
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.zxing.integration.android.IntentIntegrator
import com.karumi.dexter.Dexter
import com.karumi.dexter.MultiplePermissionsReport
import com.karumi.dexter.PermissionToken
import com.karumi.dexter.listener.PermissionRequest
import com.karumi.dexter.listener.multi.MultiplePermissionsListener
import com.remotecontrol.android.databinding.ActivityMainBinding
import com.remotecontrol.android.service.ScreenCaptureService
import com.remotecontrol.android.service.WebRTCService
import com.remotecontrol.android.service.WebSocketService
import com.remotecontrol.android.utils.DeviceUtils
import com.remotecontrol.android.utils.NetworkUtils
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    
    private var webSocketService: WebSocketService? = null
    private var webRTCService: WebRTCService? = null
    private var screenCaptureService: ScreenCaptureService? = null
    
    private var isServiceBound = false
    
    private val mediaProjectionManager by lazy {
        getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    }
    
    private val screenCaptureRequestLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.let { data ->
                startScreenCaptureService(data)
            }
        } else {
            showToast("Screen capture permission denied")
        }
    }
    
    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.all { it.value }
        if (allGranted) {
            checkAccessibilityPermission()
        } else {
            showToast("Some permissions were denied. App may not work properly.")
        }
    }

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            when (name?.className) {
                WebSocketService::class.java.name -> {
                    webSocketService = (service as WebSocketService.LocalBinder).getService()
                    updateConnectionStatus()
                }
                WebRTCService::class.java.name -> {
                    webRTCService = (service as WebRTCService.LocalBinder).getService()
                }
                ScreenCaptureService::class.java.name -> {
                    screenCaptureService = (service as ScreenCaptureService.LocalBinder).getService()
                }
            }
            isServiceBound = true
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            when (name?.className) {
                WebSocketService::class.java.name -> webSocketService = null
                WebRTCService::class.java.name -> webRTCService = null
                ScreenCaptureService::class.java.name -> screenCaptureService = null
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        requestPermissions()
    }

    private fun setupUI() {
        // Device information
        binding.apply {
            deviceNameText.text = DeviceUtils.getDeviceName()
            deviceModelText.text = DeviceUtils.getDeviceModel()
            androidVersionText.text = "Android ${DeviceUtils.getAndroidVersion()}"
            screenResolutionText.text = DeviceUtils.getScreenResolution(this@MainActivity)
            
            // Network information
            lifecycleScope.launch {
                val networkInfo = NetworkUtils.getNetworkInfo(this@MainActivity)
                ipAddressText.text = networkInfo.ipAddress
                networkNameText.text = networkInfo.networkName
            }

            // Buttons
            btnStartService.setOnClickListener { 
                if (checkAllPermissions()) {
                    startAllServices()
                } else {
                    requestPermissions()
                }
            }
            
            btnStopService.setOnClickListener { 
                stopAllServices()
            }
            
            btnSettings.setOnClickListener {
                startActivity(Intent(this@MainActivity, SettingsActivity::class.java))
            }
            
            btnScanQR.setOnClickListener {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) 
                    == PackageManager.PERMISSION_GRANTED) {
                    startQRScanner()
                } else {
                    ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.CAMERA), 100)
                }
            }
            
            btnScreenCapture.setOnClickListener {
                requestScreenCapturePermission()
            }
            
            btnAccessibility.setOnClickListener {
                openAccessibilitySettings()
            }

            // Status refresh
            swipeRefresh.setOnRefreshListener {
                updateConnectionStatus()
                swipeRefresh.isRefreshing = false
            }
        }
        
        updateConnectionStatus()
    }

    private fun requestPermissions() {
        val permissions = mutableListOf<String>().apply {
            add(Manifest.permission.INTERNET)
            add(Manifest.permission.ACCESS_NETWORK_STATE)
            add(Manifest.permission.ACCESS_WIFI_STATE)
            add(Manifest.permission.RECORD_AUDIO)
            add(Manifest.permission.MODIFY_AUDIO_SETTINGS)
            add(Manifest.permission.WAKE_LOCK)
            add(Manifest.permission.FOREGROUND_SERVICE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.S_V2) {
                add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }

        Dexter.withContext(this)
            .withPermissions(permissions)
            .withListener(object : MultiplePermissionsListener {
                override fun onPermissionsChecked(report: MultiplePermissionsReport?) {
                    if (report?.areAllPermissionsGranted() == true) {
                        checkAccessibilityPermission()
                    } else {
                        showToast("Some permissions are required for the app to work properly")
                    }
                }

                override fun onPermissionRationaleShouldBeShown(
                    permissions: MutableList<PermissionRequest>?,
                    token: PermissionToken?
                ) {
                    MaterialAlertDialogBuilder(this@MainActivity)
                        .setTitle("Permissions Required")
                        .setMessage("This app needs various permissions to control your device remotely.")
                        .setPositiveButton("Grant") { _, _ -> token?.continuePermissionRequest() }
                        .setNegativeButton("Deny") { _, _ -> token?.cancelPermissionRequest() }
                        .show()
                }
            }).check()
    }

    private fun checkAllPermissions(): Boolean {
        return checkBasicPermissions() && 
               checkAccessibilityPermission() && 
               checkOverlayPermission() &&
               checkScreenCapturePermission()
    }

    private fun checkBasicPermissions(): Boolean {
        val permissions = arrayOf(
            Manifest.permission.INTERNET,
            Manifest.permission.ACCESS_NETWORK_STATE,
            Manifest.permission.ACCESS_WIFI_STATE,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.MODIFY_AUDIO_SETTINGS,
            Manifest.permission.WAKE_LOCK,
            Manifest.permission.FOREGROUND_SERVICE
        )
        
        return permissions.all { 
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED 
        }
    }

    private fun checkAccessibilityPermission(): Boolean {
        val accessibilityManager = getSystemService(Context.ACCESSIBILITY_SERVICE) as android.view.accessibility.AccessibilityManager
        val enabledServices = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        )
        
        val serviceName = "${packageName}/${TouchAccessibilityService::class.java.name}"
        return enabledServices?.contains(serviceName) == true
    }

    private fun checkOverlayPermission(): Boolean {
        return Settings.canDrawOverlays(this)
    }

    private fun checkScreenCapturePermission(): Boolean {
        // Screen capture permission is requested on demand
        return true
    }

    private fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        startActivity(intent)
    }

    private fun requestScreenCapturePermission() {
        val intent = mediaProjectionManager.createScreenCaptureIntent()
        screenCaptureRequestLauncher.launch(intent)
    }

    private fun startQRScanner() {
        IntentIntegrator(this).apply {
            setPrompt("Scan QR code from web browser")
            setBeepEnabled(true)
            setBarcodeImageEnabled(true)
            setOrientationLocked(false)
            initiateScan()
        }
    }

    private fun startAllServices() {
        // Start WebSocket service
        Intent(this, WebSocketService::class.java).also { intent ->
            startService(intent)
            bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
        }

        // Start WebRTC service
        Intent(this, WebRTCService::class.java).also { intent ->
            startService(intent)
            bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
        }

        updateConnectionStatus()
        showToast("Services started")
    }

    private fun stopAllServices() {
        if (isServiceBound) {
            unbindService(serviceConnection)
            isServiceBound = false
        }

        stopService(Intent(this, WebSocketService::class.java))
        stopService(Intent(this, WebRTCService::class.java))
        stopService(Intent(this, ScreenCaptureService::class.java))

        webSocketService = null
        webRTCService = null
        screenCaptureService = null

        updateConnectionStatus()
        showToast("Services stopped")
    }

    private fun startScreenCaptureService(data: Intent) {
        Intent(this, ScreenCaptureService::class.java).also { intent ->
            intent.putExtra("mediaProjectionData", data)
            startService(intent)
            bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
        }
    }

    private fun updateConnectionStatus() {
        binding.apply {
            val isConnected = webSocketService?.isConnected() == true
            
            connectionStatusCard.setCardBackgroundColor(
                ContextCompat.getColor(
                    this@MainActivity,
                    if (isConnected) R.color.success_color else R.color.error_color
                )
            )
            
            connectionStatusText.text = if (isConnected) "Connected" else "Disconnected"
            
            btnStartService.isEnabled = !isConnected
            btnStopService.isEnabled = isConnected
        }
    }

    private fun showToast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        
        // Handle QR scanner result
        val result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data)
        if (result != null && result.contents != null) {
            // Parse QR code data (should contain server URL and pairing code)
            handleQRCodeResult(result.contents)
        }
    }

    private fun handleQRCodeResult(contents: String) {
        try {
            // Expected format: ws://ip:port/socket.io/?deviceId=xxx&pairingCode=xxx
            val uri = Uri.parse(contents)
            val serverUrl = "${uri.scheme}://${uri.host}:${uri.port}"
            val deviceId = uri.getQueryParameter("deviceId")
            val pairingCode = uri.getQueryParameter("pairingCode")
            
            if (serverUrl.isNotEmpty() && !deviceId.isNullOrEmpty()) {
                // Save connection settings
                val sharedPrefs = getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
                sharedPrefs.edit().apply {
                    putString("server_url", serverUrl)
                    putString("device_id", deviceId)
                    putString("pairing_code", pairingCode)
                    apply()
                }
                
                showToast("Connection settings saved from QR code")
                
                // Auto-start services if permissions are granted
                if (checkAllPermissions()) {
                    startAllServices()
                }
            } else {
                showToast("Invalid QR code format")
            }
        } catch (e: Exception) {
            showToast("Failed to parse QR code: ${e.message}")
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isServiceBound) {
            unbindService(serviceConnection)
        }
    }
}