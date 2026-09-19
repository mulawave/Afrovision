package com.afrovision.tv.player

import android.util.Log
import com.afrovision.tv.BASE_URL
import com.afrovision.tv.TV_APP_TAG
import com.afrovision.tv.data.api.TokenHolder
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

/**
 * Live-viewer presence for channel playback (see
 * backend/src/realtime/socket.service.js channel:join / channel:leave —
 * the same room the Flutter app and website join). Reported with
 * platform "tv" so the admin live-viewers dashboard can break the current
 * viewer count down by platform; the backend trusts this since the
 * connection authenticates with this device's tv_device JWT regardless of
 * what platform value is sent.
 *
 * Kept as its own connection rather than reused from ChatSocket since its
 * lifecycle is tied to the player screen (join on play, leave on stop),
 * not app-wide messaging.
 */
object ChannelViewerSocket {
    private var socket: Socket? = null
    private var currentChannelId: String? = null

    fun join(channelId: String) {
        if (currentChannelId == channelId && socket?.connected() == true) return
        leave()

        val token = TokenHolder.token
        if (token.isBlank()) return

        try {
            val opts = IO.Options.builder()
                .setAuth(mapOf("token" to token))
                .setReconnection(true)
                .build()
            val s = IO.socket(BASE_URL, opts)
            currentChannelId = channelId

            s.on(Socket.EVENT_CONNECT) {
                s.emit(
                    "channel:join",
                    JSONObject().put("channelId", channelId).put("platform", "tv")
                )
            }
            s.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.e(TV_APP_TAG, "ChannelViewerSocket connect error: ${args.firstOrNull()}")
            }

            socket = s
            s.connect()
        } catch (e: Exception) {
            Log.e(TV_APP_TAG, "ChannelViewerSocket.join failed", e)
        }
    }

    fun leave() {
        val channelId = currentChannelId
        val s = socket
        if (s != null && channelId != null) {
            s.emit("channel:leave", JSONObject().put("channelId", channelId))
        }
        s?.disconnect()
        s?.off()
        socket = null
        currentChannelId = null
    }
}
