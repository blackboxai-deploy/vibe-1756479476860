package com.remotecontrol.android.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.PointF
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import kotlinx.coroutines.*
import org.json.JSONObject

class TouchAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "TouchAccessibilityService"
        private var instance: TouchAccessibilityService? = null
        
        fun getInstance(): TouchAccessibilityService? = instance
    }

    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.d(TAG, "Touch Accessibility Service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We don't need to handle accessibility events for our use case
    }

    override fun onInterrupt() {
        Log.d(TAG, "Touch Accessibility Service interrupted")
    }

    /**
     * Perform touch action based on command received from web client
     */
    fun performTouch(command: JSONObject) {
        try {
            val type = command.getString("type")
            val x = (command.getDouble("x") * resources.displayMetrics.widthPixels).toFloat()
            val y = (command.getDouble("y") * resources.displayMetrics.heightPixels).toFloat()
            
            when (type) {
                "touch" -> performSingleTouch(x, y)
                "move" -> performMove(x, y)
                "release" -> performRelease(x, y)
                "swipe" -> performSwipe(command)
                "pinch" -> performPinch(command)
                "long_press" -> performLongPress(x, y)
                "double_tap" -> performDoubleTap(x, y)
                else -> Log.w(TAG, "Unknown touch type: $type")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error performing touch: ${e.message}", e)
        }
    }

    private fun performSingleTouch(x: Float, y: Float) {
        val path = Path().apply {
            moveTo(x, y)
        }
        
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 10))
            .build()
        
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                Log.d(TAG, "Single touch completed at ($x, $y)")
            }
            
            override fun onCancelled(gestureDescription: GestureDescription?) {
                Log.w(TAG, "Single touch cancelled")
            }
        }, null)
    }

    private fun performMove(x: Float, y: Float) {
        // For move gestures, we typically handle them as part of a drag operation
        performSingleTouch(x, y)
    }

    private fun performRelease(x: Float, y: Float) {
        // Release is typically the end of a touch sequence
        // For simplicity, we'll just perform a quick touch
        performSingleTouch(x, y)
    }

    private fun performSwipe(command: JSONObject) {
        try {
            val startX = (command.getDouble("x") * resources.displayMetrics.widthPixels).toFloat()
            val startY = (command.getDouble("y") * resources.displayMetrics.heightPixels).toFloat()
            val direction = command.getString("direction")
            val duration = command.optLong("duration", 300)
            
            val (endX, endY) = when (direction) {
                "up" -> Pair(startX, startY - 300)
                "down" -> Pair(startX, startY + 300)
                "left" -> Pair(startX - 300, startY)
                "right" -> Pair(startX + 300, startY)
                else -> Pair(startX, startY)
            }
            
            performSwipeGesture(startX, startY, endX, endY, duration)
        } catch (e: Exception) {
            Log.e(TAG, "Error performing swipe: ${e.message}", e)
        }
    }

    private fun performSwipeGesture(startX: Float, startY: Float, endX: Float, endY: Float, duration: Long) {
        val path = Path().apply {
            moveTo(startX, startY)
            lineTo(endX, endY)
        }
        
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, duration))
            .build()
        
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                Log.d(TAG, "Swipe completed from ($startX, $startY) to ($endX, $endY)")
            }
            
            override fun onCancelled(gestureDescription: GestureDescription?) {
                Log.w(TAG, "Swipe cancelled")
            }
        }, null)
    }

    private fun performPinch(command: JSONObject) {
        try {
            val centerX = (command.getDouble("x") * resources.displayMetrics.widthPixels).toFloat()
            val centerY = (command.getDouble("y") * resources.displayMetrics.heightPixels).toFloat()
            val scale = command.getDouble("scale").toFloat()
            
            val startDistance = 200f
            val endDistance = startDistance * scale
            
            // Create two paths for pinch gesture
            val path1 = Path().apply {
                moveTo(centerX - startDistance / 2, centerY)
                lineTo(centerX - endDistance / 2, centerY)
            }
            
            val path2 = Path().apply {
                moveTo(centerX + startDistance / 2, centerY)
                lineTo(centerX + endDistance / 2, centerY)
            }
            
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path1, 0, 300))
                .addStroke(GestureDescription.StrokeDescription(path2, 0, 300))
                .build()
            
            dispatchGesture(gesture, object : GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    Log.d(TAG, "Pinch gesture completed with scale: $scale")
                }
                
                override fun onCancelled(gestureDescription: GestureDescription?) {
                    Log.w(TAG, "Pinch gesture cancelled")
                }
            }, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error performing pinch: ${e.message}", e)
        }
    }

    private fun performLongPress(x: Float, y: Float) {
        val path = Path().apply {
            moveTo(x, y)
        }
        
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 1000)) // 1 second long press
            .build()
        
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                Log.d(TAG, "Long press completed at ($x, $y)")
            }
            
            override fun onCancelled(gestureDescription: GestureDescription?) {
                Log.w(TAG, "Long press cancelled")
            }
        }, null)
    }

    private fun performDoubleTap(x: Float, y: Float) {
        serviceScope.launch {
            // First tap
            performSingleTouch(x, y)
            
            // Wait a bit
            delay(100)
            
            // Second tap
            performSingleTouch(x, y)
            
            Log.d(TAG, "Double tap completed at ($x, $y)")
        }
    }

    /**
     * Perform device command (volume, brightness, navigation buttons)
     */
    fun performDeviceCommand(command: JSONObject) {
        try {
            val type = command.getString("type")
            
            when (type) {
                "home" -> performGlobalAction(GLOBAL_ACTION_HOME)
                "back" -> performGlobalAction(GLOBAL_ACTION_BACK)
                "recent" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
                "notifications" -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
                "quick_settings" -> performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)
                "power_dialog" -> performGlobalAction(GLOBAL_ACTION_POWER_DIALOG)
                "toggle_split_screen" -> performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN)
                "lock_screen" -> performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)
                "take_screenshot" -> performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT)
                else -> Log.w(TAG, "Unknown device command: $type")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error performing device command: ${e.message}", e)
        }
    }

    /**
     * Perform key event simulation
     */
    fun performKeyEvent(command: JSONObject) {
        try {
            val keyCode = command.getInt("keyCode")
            val action = command.getString("action")
            
            // Note: AccessibilityService doesn't directly support key injection
            // We can only perform global actions that are predefined
            // For specific key codes, we would need root access or system-level permissions
            
            Log.d(TAG, "Key event request: keyCode=$keyCode, action=$action")
            Log.w(TAG, "Direct key injection not supported via AccessibilityService")
        } catch (e: Exception) {
            Log.e(TAG, "Error performing key event: ${e.message}", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        instance = null
        Log.d(TAG, "Touch Accessibility Service destroyed")
    }
}