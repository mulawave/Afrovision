package com.afrovision.tv.chat

import android.util.Log
import com.afrovision.tv.BASE_URL
import com.afrovision.tv.TV_APP_TAG
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

/**
 * Live delivery for TV-to-TV chat (see backend/src/realtime/socket.service.js
 * registerAdtvChatHandlers). Namespaced adtv_chat:* server-side so it can't
 * collide with the existing per-channel live-chat socket events.
 *
 * Kept deliberately dumb: on any adtv_chat:message / adtv_chat:badge event
 * this just tells the caller "something changed, go refetch" rather than
 * hand-parsing the payload into our models - one source of truth for shapes
 * (the REST responses / ChatMessage etc.) instead of two.
 */
object ChatSocket {
    private var socket: Socket? = null
    private var currentConnectionRoom: String? = null

    fun connect(
        deviceToken: String,
        onBadgeChanged: () -> Unit,
        onMessageForConnection: (connectionId: String) -> Unit
    ) {
        if (socket?.connected() == true) return
        try {
            val opts = IO.Options.builder()
                .setAuth(mapOf("token" to deviceToken))
                .setReconnection(true)
                .build()
            val s = IO.socket(BASE_URL, opts)

            s.on(Socket.EVENT_CONNECT) {
                Log.d(TV_APP_TAG, "ChatSocket connected")
                currentConnectionRoom?.let { joinConnection(it) }
            }
            s.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.e(TV_APP_TAG, "ChatSocket connect error: ${args.firstOrNull()}")
            }
            s.on("adtv_chat:badge") {
                onBadgeChanged()
            }
            s.on("adtv_chat:message") { args ->
                val payload = args.firstOrNull() as? JSONObject
                val connectionId = payload?.optString("connection_id")
                if (!connectionId.isNullOrBlank()) {
                    onMessageForConnection(connectionId)
                }
                onBadgeChanged()
            }

            socket = s
            s.connect()
        } catch (e: Exception) {
            Log.e(TV_APP_TAG, "ChatSocket.connect failed", e)
        }
    }

    fun joinConnection(connectionId: String) {
        currentConnectionRoom = connectionId
        socket?.emit("adtv_chat:join", JSONObject().put("connectionId", connectionId))
    }

    fun leaveConnection(connectionId: String) {
        if (currentConnectionRoom == connectionId) currentConnectionRoom = null
        socket?.emit("adtv_chat:leave", JSONObject().put("connectionId", connectionId))
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
        currentConnectionRoom = null
    }
}
