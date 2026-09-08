package com.afrovision.tv.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "afrovision_tv_prefs")

class TvDataStore(context: Context) {

    private val dataStore = context.dataStore

    val token: Flow<String> = dataStore.data.map { it[KEY_TOKEN] ?: "" }
    val refreshToken: Flow<String> = dataStore.data.map { it[KEY_REFRESH_TOKEN] ?: "" }
    val deviceId: Flow<String> = dataStore.data.map { it[KEY_DEVICE_ID] ?: "" }
    val isPaired: Flow<Boolean> = dataStore.data.map { it[KEY_PAIRED] == true }
    val userName: Flow<String> = dataStore.data.map { it[KEY_USER_NAME] ?: "" }
    val userAvatar: Flow<String> = dataStore.data.map { it[KEY_USER_AVATAR] ?: "" }
    val defaultQuality: Flow<String> = dataStore.data.map { it[KEY_DEFAULT_QUALITY] ?: "auto" }
    val subtitlesEnabled: Flow<Boolean> = dataStore.data.map { it[KEY_SUBTITLES] != false }
    val soundEffects: Flow<Boolean> = dataStore.data.map { it[KEY_SOUND_EFFECTS] != false }
    val hdrPassthrough: Flow<Boolean> = dataStore.data.map { it[KEY_HDR_PASSTHROUGH] == true }
    val safeAreaEnabled: Flow<Boolean> = dataStore.data.map { it[KEY_SAFE_AREA] != false }
    val networkProfile: Flow<String> = dataStore.data.map { it[KEY_NETWORK_PROFILE] ?: "auto" }
    val autoplay: Flow<Boolean> = dataStore.data.map { it[KEY_AUTOPLAY] != false }

    suspend fun setToken(value: String) = dataStore.edit { it[KEY_TOKEN] = value }
    suspend fun setRefreshToken(value: String) = dataStore.edit { it[KEY_REFRESH_TOKEN] = value }
    suspend fun setDeviceId(value: String) = dataStore.edit { it[KEY_DEVICE_ID] = value }
    suspend fun setPaired(value: Boolean) = dataStore.edit { it[KEY_PAIRED] = value }
    suspend fun setUserName(value: String) = dataStore.edit { it[KEY_USER_NAME] = value }
    suspend fun setUserAvatar(value: String) = dataStore.edit { it[KEY_USER_AVATAR] = value }
    suspend fun setDefaultQuality(value: String) = dataStore.edit { it[KEY_DEFAULT_QUALITY] = value }
    suspend fun setSubtitlesEnabled(value: Boolean) = dataStore.edit { it[KEY_SUBTITLES] = value }
    suspend fun setSoundEffects(value: Boolean) = dataStore.edit { it[KEY_SOUND_EFFECTS] = value }
    suspend fun setHdrPassthrough(value: Boolean) = dataStore.edit { it[KEY_HDR_PASSTHROUGH] = value }
    suspend fun setSafeAreaEnabled(value: Boolean) = dataStore.edit { it[KEY_SAFE_AREA] = value }
    suspend fun setNetworkProfile(value: String) = dataStore.edit { it[KEY_NETWORK_PROFILE] = value }
    suspend fun setAutoplay(value: Boolean) = dataStore.edit { it[KEY_AUTOPLAY] = value }

    companion object {
        private val KEY_TOKEN = stringPreferencesKey("auth_token")
        private val KEY_REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        private val KEY_DEVICE_ID = stringPreferencesKey("device_id")
        private val KEY_PAIRED = booleanPreferencesKey("is_paired")
        private val KEY_USER_NAME = stringPreferencesKey("user_name")
        private val KEY_USER_AVATAR = stringPreferencesKey("user_avatar")
        private val KEY_DEFAULT_QUALITY = stringPreferencesKey("default_quality")
        private val KEY_SUBTITLES = booleanPreferencesKey("subtitles_enabled")
        private val KEY_SOUND_EFFECTS = booleanPreferencesKey("sound_effects")
        private val KEY_HDR_PASSTHROUGH = booleanPreferencesKey("hdr_passthrough")
        private val KEY_SAFE_AREA = booleanPreferencesKey("safe_area")
        private val KEY_NETWORK_PROFILE = stringPreferencesKey("network_profile")
        private val KEY_AUTOPLAY = booleanPreferencesKey("autoplay")
    }
}
