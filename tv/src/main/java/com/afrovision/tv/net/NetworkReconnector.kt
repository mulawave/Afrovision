package com.afrovision.tv.net

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.wifi.WifiManager
import android.util.Log
import com.afrovision.tv.TV_APP_TAG
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Some TV boxes just sit disconnected after a Wi-Fi blip instead of
 * reassociating on their own - the user has to back out to system Settings
 * and reconnect by hand. This forces reconnection to the already-saved
 * network instead, without the user leaving the app.
 *
 * The one thing this must get right is telling a genuine drop apart from a
 * merely bad connection: a slow/metered/low-signal network is still an
 * active network (ConnectivityManager keeps reporting it, ACTIVE_NETWORK
 * stays non-null) and must never trigger this - only a real loss (onLost
 * fires AND no network at all comes back within a grace window) does.
 */
class NetworkReconnector(app: Application) {
    private val context = app.applicationContext
    private val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val wifiManager = context.applicationContext
        .getSystemService(Context.WIFI_SERVICE) as? WifiManager

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var dropConfirmJob: Job? = null
    private var reconnectLoopJob: Job? = null
    private var wifiLock: WifiManager.WifiLock? = null

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            // Real connectivity is back - stop trying.
            dropConfirmJob?.cancel()
            reconnectLoopJob?.cancel()
            _online.value = true
        }

        override fun onLost(network: Network) {
            // Debounce: a roaming handoff or a momentary blip also fires
            // onLost and then onAvailable a moment later. Only escalate to
            // the force-reconnect loop if, after a grace period, the device
            // is still left with no active network whatsoever - never for a
            // network that's merely degraded (that never reaches onLost at
            // all; a bad-but-connected network keeps reporting as active).
            dropConfirmJob?.cancel()
            dropConfirmJob = scope.launch {
                delay(GRACE_PERIOD_MS)
                if (cm.activeNetwork == null) {
                    Log.w(TV_APP_TAG, "Network confirmed dropped after grace period, forcing reconnect")
                    _online.value = false
                    startReconnectLoop()
                }
            }
        }
    }

    fun start() {
        _online.value = cm.activeNetwork != null
        try {
            cm.registerDefaultNetworkCallback(callback)
        } catch (e: Exception) {
            Log.e(TV_APP_TAG, "NetworkReconnector: failed to register callback", e)
        }
        // Launched with no network at all: start recovering straight away.
        if (cm.activeNetwork == null) startReconnectLoop()
    }

    /**
     * Keeps the Wi-Fi radio fully awake while the app is in the foreground.
     * Low-cost TV firmware aggressively power-saves Wi-Fi when it thinks the
     * device is idle (including during playback), which drops the link to a
     * perfectly healthy hotspot. Unlike forcing a reconnect, a Wi-Fi lock is
     * allowed for every app on every Android version.
     */
    fun acquireWifiLock() {
        val wifi = wifiManager ?: return
        try {
            if (wifiLock == null) {
                @Suppress("DEPRECATION")
                val mode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                } else {
                    WifiManager.WIFI_MODE_FULL_HIGH_PERF
                }
                wifiLock = wifi.createWifiLock(mode, "AfroVision:foreground").apply { setReferenceCounted(false) }
            }
            if (wifiLock?.isHeld == false) wifiLock?.acquire()
        } catch (e: Exception) {
            Log.e(TV_APP_TAG, "NetworkReconnector: could not acquire Wi-Fi lock", e)
        }
    }

    fun releaseWifiLock() {
        try {
            if (wifiLock?.isHeld == true) wifiLock?.release()
        } catch (_: Exception) {
        }
    }

    fun stop() {
        try {
            cm.unregisterNetworkCallback(callback)
        } catch (_: Exception) {
        }
        dropConfirmJob?.cancel()
        reconnectLoopJob?.cancel()
    }

    private fun startReconnectLoop() {
        if (reconnectLoopJob?.isActive == true) return
        val wifi = wifiManager ?: return
        reconnectLoopJob = scope.launch {
            var attempt = 0
            while (isActive && cm.activeNetwork == null) {
                attempt++
                try {
                    // On Android 10+ the enable/reconnect calls below are
                    // ignored for normal apps. A scan still is not: it makes
                    // the system re-evaluate saved networks and rejoin the
                    // hotspot as soon as it sees it.
                    @Suppress("DEPRECATION")
                    wifi.startScan()
                    @Suppress("DEPRECATION")
                    if (!wifi.isWifiEnabled) wifi.isWifiEnabled = true
                    @Suppress("DEPRECATION")
                    wifi.reconnect()

                    // Plain reassociate doesn't always recover a stuck Wi-Fi
                    // stack on older/less capable TV firmware. Escalate to a
                    // full radio toggle every few attempts.
                    if (attempt % RADIO_TOGGLE_EVERY_N_ATTEMPTS == 0) {
                        Log.w(TV_APP_TAG, "NetworkReconnector: reassociate alone hasn't worked, toggling Wi-Fi radio (attempt $attempt)")
                        @Suppress("DEPRECATION")
                        wifi.isWifiEnabled = false
                        delay(RADIO_TOGGLE_OFF_MS)
                        @Suppress("DEPRECATION")
                        wifi.isWifiEnabled = true
                    }
                } catch (e: Exception) {
                    Log.e(TV_APP_TAG, "NetworkReconnector: reconnect attempt $attempt failed", e)
                }
                delay(RETRY_INTERVAL_MS)
            }
            if (cm.activeNetwork != null) {
                Log.i(TV_APP_TAG, "NetworkReconnector: connection restored after $attempt attempt(s)")
            }
        }
    }

    companion object {
        private val _online = MutableStateFlow(true)

        /** False from a confirmed drop (after the grace period) until any network is back. */
        val online: StateFlow<Boolean> = _online

        private const val GRACE_PERIOD_MS = 5_000L
        private const val RETRY_INTERVAL_MS = 10_000L
        private const val RADIO_TOGGLE_EVERY_N_ATTEMPTS = 4
        private const val RADIO_TOGGLE_OFF_MS = 1_500L
    }
}
