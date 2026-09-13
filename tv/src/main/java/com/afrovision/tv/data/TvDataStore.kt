package com.afrovision.tv.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "afrovision_tv_prefs")

@Serializable
data class RecentChannel(
    val id: String,
    val name: String,
    val logoUrl: String? = null,
    val bannerUrl: String? = null,
    val viewedAt: Long = 0L
)

class TvDataStore(context: Context) {

    private val dataStore = context.dataStore
    private val recentJson = Json { ignoreUnknownKeys = true }

    val token: Flow<String> = dataStore.data.map { it[KEY_TOKEN] ?: "" }
    // Separate from `token`: this is always the "tv_device"-kind JWT from
    // distribution activation, used only for /distribution/tv/* calls
    // (heartbeat, channels, messages). `token` doubles as the device token
    // until QR pairing upgrades it to a real user JWT for general content
    // endpoints - without a separate slot, that upgrade overwrote the only
    // copy of the device token, breaking heartbeat/update-checking for any
    // TV that had ever been QR-paired.
    val deviceToken: Flow<String> = dataStore.data.map { it[KEY_DEVICE_TOKEN] ?: "" }
    val refreshToken: Flow<String> = dataStore.data.map { it[KEY_REFRESH_TOKEN] ?: "" }
    val deviceId: Flow<String> = dataStore.data.map { it[KEY_DEVICE_ID] ?: "" }
    val isPaired: Flow<Boolean> = dataStore.data.map { it[KEY_PAIRED] == true }
    val userName: Flow<String> = dataStore.data.map { it[KEY_USER_NAME] ?: "" }
    val userAvatar: Flow<String> = dataStore.data.map { it[KEY_USER_AVATAR] ?: "" }
    val defaultQuality: Flow<String> = dataStore.data.map { it[KEY_DEFAULT_QUALITY] ?: "auto" }
    val subtitlesEnabled: Flow<Boolean> = dataStore.data.map { it[KEY_SUBTITLES] != false }
    val soundEffects: Flow<Boolean> = dataStore.data.map { it[KEY_SOUND_EFFECTS] != false }
    val soundVolume: Flow<Float> = dataStore.data.map { it[KEY_SOUND_VOLUME] ?: 0.5f }
    val hdrPassthrough: Flow<Boolean> = dataStore.data.map { it[KEY_HDR_PASSTHROUGH] == true }
    val safeAreaEnabled: Flow<Boolean> = dataStore.data.map { it[KEY_SAFE_AREA] != false }
    val networkProfile: Flow<String> = dataStore.data.map { it[KEY_NETWORK_PROFILE] ?: "auto" }
    val autoplay: Flow<Boolean> = dataStore.data.map { it[KEY_AUTOPLAY] != false }
    val recentChannels: Flow<List<RecentChannel>> = dataStore.data.map { data ->
        val json = data[KEY_RECENT_CHANNELS] ?: ""
        if (json.isBlank()) emptyList()
        else try {
            recentJson.decodeFromString(ListSerializer(RecentChannel.serializer()), json)
        } catch (_: Exception) {
            emptyList()
        }
    }

    suspend fun setToken(value: String) = dataStore.edit { it[KEY_TOKEN] = value }
    suspend fun setDeviceToken(value: String) = dataStore.edit { it[KEY_DEVICE_TOKEN] = value }
    suspend fun setRefreshToken(value: String) = dataStore.edit { it[KEY_REFRESH_TOKEN] = value }
    suspend fun setDeviceId(value: String) = dataStore.edit { it[KEY_DEVICE_ID] = value }
    suspend fun setPaired(value: Boolean) = dataStore.edit { it[KEY_PAIRED] = value }
    suspend fun setUserName(value: String) = dataStore.edit { it[KEY_USER_NAME] = value }
    suspend fun setUserAvatar(value: String) = dataStore.edit { it[KEY_USER_AVATAR] = value }
    suspend fun setDefaultQuality(value: String) = dataStore.edit { it[KEY_DEFAULT_QUALITY] = value }
    suspend fun setSubtitlesEnabled(value: Boolean) = dataStore.edit { it[KEY_SUBTITLES] = value }
    suspend fun setSoundEffects(value: Boolean) = dataStore.edit { it[KEY_SOUND_EFFECTS] = value }
    suspend fun setSoundVolume(value: Float) = dataStore.edit { it[KEY_SOUND_VOLUME] = value }
    suspend fun setHdrPassthrough(value: Boolean) = dataStore.edit { it[KEY_HDR_PASSTHROUGH] = value }
    suspend fun setSafeAreaEnabled(value: Boolean) = dataStore.edit { it[KEY_SAFE_AREA] = value }
    suspend fun setNetworkProfile(value: String) = dataStore.edit { it[KEY_NETWORK_PROFILE] = value }
    suspend fun setAutoplay(value: Boolean) = dataStore.edit { it[KEY_AUTOPLAY] = value }

    suspend fun recordRecentChannel(channel: RecentChannel) {
        dataStore.edit { prefs ->
            val current = prefs[KEY_RECENT_CHANNELS] ?: ""
            val list = if (current.isBlank()) emptyList()
                else try { recentJson.decodeFromString(ListSerializer(RecentChannel.serializer()), current) } catch (_: Exception) { emptyList() }
            val updated = listOf(channel) + list.filterNot { it.id == channel.id }
            // 20, not 10 - the Waves screen's "Recently watched" rail auto-
            // slides, and with only a handful of entries the whole row
            // already fits on screen with nothing to scroll to, so the
            // slide looked broken even though it was running.
            val trimmed = updated.take(20)
            prefs[KEY_RECENT_CHANNELS] = recentJson.encodeToString(ListSerializer(RecentChannel.serializer()), trimmed)
        }
    }

    companion object {
        private val KEY_TOKEN = stringPreferencesKey("auth_token")
        private val KEY_DEVICE_TOKEN = stringPreferencesKey("device_token")
        private val KEY_REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        private val KEY_DEVICE_ID = stringPreferencesKey("device_id")
        private val KEY_PAIRED = booleanPreferencesKey("is_paired")
        private val KEY_USER_NAME = stringPreferencesKey("user_name")
        private val KEY_USER_AVATAR = stringPreferencesKey("user_avatar")
        private val KEY_DEFAULT_QUALITY = stringPreferencesKey("default_quality")
        private val KEY_SUBTITLES = booleanPreferencesKey("subtitles_enabled")
        private val KEY_SOUND_EFFECTS = booleanPreferencesKey("sound_effects")
        private val KEY_SOUND_VOLUME = floatPreferencesKey("sound_volume")
        private val KEY_HDR_PASSTHROUGH = booleanPreferencesKey("hdr_passthrough")
        private val KEY_SAFE_AREA = booleanPreferencesKey("safe_area")
        private val KEY_NETWORK_PROFILE = stringPreferencesKey("network_profile")
        private val KEY_AUTOPLAY = booleanPreferencesKey("autoplay")
        private val KEY_RECENT_CHANNELS = stringPreferencesKey("recent_channels")
    }
}
