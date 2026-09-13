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

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            // Real connectivity is back - stop trying.
            dropConfirmJob?.cancel()
            reconnectLoopJob?.cancel()
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
                    startReconnectLoop()
                }
            }
        }
    }

    fun start() {
        try {
            cm.registerDefaultNetworkCallback(callback)
        } catch (e: Exception) {
            Log.e(TV_APP_TAG, "NetworkReconnector: failed to register callback", e)
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

    private companion object {
        const val GRACE_PERIOD_MS = 5_000L
        const val RETRY_INTERVAL_MS = 10_000L
        const val RADIO_TOGGLE_EVERY_N_ATTEMPTS = 4
        const val RADIO_TOGGLE_OFF_MS = 1_500L
    }
}
