package com.afrovision.tv.data

import android.app.Application
import android.net.Uri
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.afrovision.tv.TV_APP_TAG
import com.afrovision.tv.data.api.RetrofitClient
import com.afrovision.tv.data.api.TokenHolder
import com.afrovision.tv.data.recommendation.RecommendationManager
import com.afrovision.tv.data.api.model.CatchUpHome
import com.afrovision.tv.data.api.model.CatchUpItem
import com.afrovision.tv.data.api.model.Channel
import com.afrovision.tv.data.api.model.Message
import com.afrovision.tv.data.api.model.FeedPost
import com.afrovision.tv.data.api.model.Movie
import com.afrovision.tv.data.api.model.Series
import com.afrovision.tv.data.api.model.Wave
import com.afrovision.tv.data.api.model.WatchProgress
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import com.afrovision.tv.data.api.model.ApiError
import com.afrovision.tv.data.api.model.AppUpdate
import kotlinx.serialization.json.Json
import retrofit2.HttpException

sealed class ActivationState {
    data object Idle : ActivationState()
    data object Activating : ActivationState()
    data class Activated(val reactivated: Boolean, val ownerName: String) : ActivationState()
    data class Error(val message: String, val code: String? = null) : ActivationState()
}

sealed class LoadState<out T> {
    data object Loading : LoadState<Nothing>()
    data class Success<T>(val data: T) : LoadState<T>()
    data class Error(val message: String) : LoadState<Nothing>()
}

data class HomeState(
    val continueWatching: LoadState<List<WatchProgress>> = LoadState.Loading,
    val liveChannels: LoadState<List<Channel>> = LoadState.Loading,
    val newMovies: LoadState<List<Movie>> = LoadState.Loading,
    val newSeries: LoadState<List<Series>> = LoadState.Loading,
    val waves: LoadState<List<Wave>> = LoadState.Loading,
    val library: LoadState<List<Channel>> = LoadState.Loading
)


data class MoviesSeriesState(
    val filter: String = "All",
    val movies: LoadState<List<Movie>> = LoadState.Loading,
    val series: LoadState<List<Series>> = LoadState.Loading
)

data class MediaCard(
    val id: String,
    val title: String,
    val subtitle: String = "",
    val imageUrl: String? = null,
    val progress: Float = 0f,
    val badge: String = "",
    val mediaType: String = "",
    val streamUrl: String? = null,
    val externalUrl: String? = null,
    val duration: Long = 0L
)

data class PlayerMedia(
    val id: String,
    val title: String,
    val streamUrl: String?,
    val externalUrl: String?,
    val isLive: Boolean,
    val progress: Long = 0,
    val duration: Long = 0,
    val mediaType: String = ""
)

class TvViewModel(application: Application) : AndroidViewModel(application) {

    private val dataStore = TvDataStore(application)
    private val api = RetrofitClient.api

    private val _token = MutableStateFlow("")
    val token: StateFlow<String> = _token

    private val _isPaired = MutableStateFlow(false)
    val isPaired: StateFlow<Boolean> = _isPaired

    private val _isReady = MutableStateFlow(false)
    val isReady: StateFlow<Boolean> = _isReady

    var activationState by mutableStateOf<ActivationState>(ActivationState.Idle)
        private set

    var deviceDisabledReason by mutableStateOf<String?>(null)
        private set

    var appUpdate by mutableStateOf<AppUpdate?>(null)
        private set

    var deviceId by mutableStateOf("")
        private set

    private val errorJson = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    private val _userName = MutableStateFlow("")
    val userName: StateFlow<String> = _userName

    private val _unreadMessages = mutableIntStateOf(0)
    val unreadMessages: Int by _unreadMessages

    var currentScreen by mutableStateOf(com.afrovision.tv.ui.navigation.Screen.CatchUp)
        private set

    var playerMedia by mutableStateOf<PlayerMedia?>(null)
        private set

    var selectedMovie by mutableStateOf<Movie?>(null)
    var selectedSeries by mutableStateOf<Series?>(null)

    var homeState by mutableStateOf(HomeState())
        private set

    var liveChannels by mutableStateOf<LoadState<List<Channel>>>(LoadState.Loading)
        private set

    var waves by mutableStateOf<LoadState<List<Wave>>>(LoadState.Loading)
        private set

    var moviesSeries by mutableStateOf(MoviesSeriesState())
        private set

    var library by mutableStateOf<LoadState<List<Channel>>>(LoadState.Loading)
        private set

    var exclusive by mutableStateOf<LoadState<List<MediaCard>>>(LoadState.Loading)
        private set

    var searchQuery by mutableStateOf("")
        private set

    var search by mutableStateOf<LoadState<List<MediaCard>>>(LoadState.Success(emptyList()))
        private set

    var messages by mutableStateOf<LoadState<List<Message>>>(LoadState.Loading)
        private set

    var feed by mutableStateOf<LoadState<List<FeedPost>>>(LoadState.Loading)
        private set

    var catchUp by mutableStateOf<LoadState<CatchUpHome>>(LoadState.Loading)
        private set

    var catchUpDetail by mutableStateOf<LoadState<CatchUpItem>>(LoadState.Success(CatchUpItem()))
        private set

    var selectedCatchUpItem by mutableStateOf<CatchUpItem?>(null)
        private set

    var profile by mutableStateOf(ProfileState())
        private set

    var settings by mutableStateOf(SettingsState())
        private set

    var downloads by mutableStateOf<List<DownloadItem>>(emptyList())
        private set

    val appVersion: String = DeviceIdProvider.getAppVersion(application)
    val versionCode: Long = DeviceIdProvider.getVersionCode(application)
    val deviceName: String = DeviceIdProvider.getDeviceName()

    private var heartbeatJob: Job? = null
    private var sessionPollJob: Job? = null

    init {
        viewModelScope.launch {
            ensureDeviceId()
            _token.value = dataStore.token.first()
            TokenHolder.token = _token.value
            _isPaired.value = dataStore.isPaired.first() && _token.value.isNotBlank()
            _userName.value = dataStore.userName.first()
            if (_isPaired.value) {
                currentScreen = com.afrovision.tv.ui.navigation.Screen.Home
                loadAll()
                startHeartbeat()
            } else {
                currentScreen = com.afrovision.tv.ui.navigation.Screen.Pairing
            }
            _isReady.value = true
        }
    }

    fun navigateTo(screen: com.afrovision.tv.ui.navigation.Screen) {
        if (screen == com.afrovision.tv.ui.navigation.Screen.Player) return
        currentScreen = screen
    }

    fun play(media: PlayerMedia) {
        playerMedia = media
        currentScreen = com.afrovision.tv.ui.navigation.Screen.Player
    }

    fun closePlayer() {
        val fromTrailer = playerMedia?.mediaType == "trailer"
        currentScreen = if (fromTrailer) com.afrovision.tv.ui.navigation.Screen.CatchUp else com.afrovision.tv.ui.navigation.Screen.Home
        playerMedia = null
    }

    fun loadAll() {
        loadCatchUp()
        loadHome()
        loadLiveChannels()
        loadWaves()
        loadMoviesSeries()
        loadLibrary()
        loadExclusive()
        loadMessages()
        loadFeed()
        loadProfile()
        loadSettings()
        loadDownloads()
    }

    fun loadCatchUp() {
        viewModelScope.launch {
            catchUp = LoadState.Loading
            catchUp = try {
                LoadState.Success(api.getCatchUpHome().data)
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "loadCatchUp failed", e)
                LoadState.Error(e.message ?: "Unknown")
            }
        }
    }

    fun loadCatchUpDetail(type: String, id: String) {
        viewModelScope.launch {
            catchUpDetail = LoadState.Loading
            catchUpDetail = try {
                LoadState.Success(api.getCatchUpDetail(type, id).data)
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "loadCatchUpDetail failed", e)
                LoadState.Error(e.message ?: "Unknown")
            }
        }
    }

    fun selectCatchUpItem(item: CatchUpItem) {
        selectedCatchUpItem = item
        loadCatchUpDetail(item.type, item.id)
    }

    fun clearCatchUpDetail() {
        selectedCatchUpItem = null
        catchUpDetail = LoadState.Success(CatchUpItem())
    }

    fun playCatchUpTrailer(item: CatchUpItem) {
        val url = item.trailerUrl
        if (!url.isNullOrBlank()) {
            play(
                PlayerMedia(
                    id = item.id,
                    title = item.title,
                    streamUrl = null,
                    externalUrl = url,
                    isLive = false,
                    progress = 0,
                    duration = 0,
                    mediaType = "trailer"
                )
            )
        }
    }

    fun loadHome() {
        viewModelScope.launch {
            homeState = homeState.copy(continueWatching = LoadState.Loading)
            homeState = try {
                val progress = api.getWatchProgress()
                val live = api.getChannels(mapOf("live" to "true"))
                val movies = api.getMovies(mapOf("sort" to "new"))
                val series = api.getSeries(mapOf("sort" to "new"))
                val waves = api.getWaves(mapOf("limit" to "12"))
                val library = api.getChannelLibrary()
                homeState.copy(
                    continueWatching = LoadState.Success(progress.data),
                    liveChannels = LoadState.Success(live.channels.filter { !it.isExclusive }),
                    newMovies = LoadState.Success(movies.data),
                    newSeries = LoadState.Success(series.data),
                    waves = LoadState.Success(waves.data),
                    library = LoadState.Success(library.data)
                ).also {
                    RecommendationManager.sync(getApplication(), progress.data.map { it.toMediaCard() })
                }
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "loadHome failed", e)
                homeState.copy(
                    continueWatching = LoadState.Error(e.message ?: "Unknown"),
                    liveChannels = LoadState.Error(e.message ?: "Unknown"),
                    newMovies = LoadState.Error(e.message ?: "Unknown"),
                    newSeries = LoadState.Error(e.message ?: "Unknown"),
                    waves = LoadState.Error(e.message ?: "Unknown"),
                    library = LoadState.Error(e.message ?: "Unknown")
                )
            }
        }
    }

    fun loadLiveChannels() {
        viewModelScope.launch {
            liveChannels = LoadState.Loading
            liveChannels = try {
                val response = api.getChannels(mapOf("live" to "true"))
                LoadState.Success(response.channels)
            } catch (e: Exception) {
                LoadState.Error(e.message ?: "Unknown")
            }
        }
    }

    fun loadWaves() {
        viewModelScope.launch {
            waves = LoadState.Loading
            waves = try {
                val response = api.getWaves(mapOf("limit" to "24"))
                LoadState.Success(response.data)
            } catch (e: Exception) {
                LoadState.Error(e.message ?: "Unknown")
            }
        }
    }

    fun loadMoviesSeries() {
        viewModelScope.launch {
            moviesSeries = moviesSeries.copy(
                movies = LoadState.Loading,
                series = LoadState.Loading
            )
            try {
                val movies = api.getMovies(mapOf("sort" to "new"))
                val series = api.getSeries(mapOf("sort" to "new"))
                moviesSeries = moviesSeries.copy(
                    movies = LoadState.Success(movies.data),
                    series = LoadState.Success(series.data)
                )
            } catch (e: Exception) {
                moviesSeries = moviesSeries.copy(
                    movies = LoadState.Error(e.message ?: "Unknown"),
                    series = LoadState.Error(e.message ?: "Unknown")
                )
            }
        }
    }

    fun setMoviesSeriesFilter(filter: String) {
        moviesSeries = moviesSeries.copy(filter = filter)
    }

    fun loadLibrary() {
        viewModelScope.launch {
            library = LoadState.Loading
            library = try {
                LoadState.Success(api.getChannelLibrary().data)
            } catch (e: Exception) {
                LoadState.Error(e.message ?: "Unknown")
            }
        }
    }

    fun loadExclusive() {
        viewModelScope.launch {
            exclusive = LoadState.Loading
            exclusive = try {
                val response = api.getChannels(mapOf("exclusive" to "true"))
                val cards = response.data.map {
                    MediaCard(
                        id = it.id,
                        title = it.name,
                        subtitle = it.description ?: "",
                        imageUrl = it.posterUrl,
                        mediaType = "channel"
                    )
                }
                LoadState.Success(cards)
            } catch (e: Exception) {
                LoadState.Error(e.message ?: "Unknown")
            }
        }
    }

    fun search(query: String) {
        viewModelScope.launch {
            searchQuery = query
            search = LoadState.Loading
            if (query.isBlank()) {
                search = LoadState.Success(emptyList())
                return@launch
            }
            try {
                val channels = api.getChannels(mapOf("q" to query)).data
                val movies = api.getMovies(mapOf("q" to query)).data
                val series = api.getSeries(mapOf("q" to query)).data
                val waves = api.getWaves(mapOf("q" to query)).data
                val result = mutableListOf<MediaCard>()
                result += channels.map {
                    MediaCard(id = it.id, title = it.name, imageUrl = it.posterUrl, mediaType = "channel", streamUrl = it.streamUrl, externalUrl = it.externalUrl)
                }
                result += movies.map {
                    MediaCard(id = it.id, title = it.title, imageUrl = it.posterUrl, mediaType = "movie", streamUrl = it.streamUrl, externalUrl = it.externalUrl)
                }
                result += series.map {
                    MediaCard(id = it.id, title = it.title, imageUrl = it.posterUrl, mediaType = "series")
                }
                result += waves.map {
                    MediaCard(id = it.id, title = it.title, imageUrl = it.thumbnailUrl, mediaType = "wave", streamUrl = it.streamUrl, externalUrl = it.externalUrl)
                }
                search = LoadState.Success(result)
            } catch (e: Exception) {
                search = LoadState.Error(e.message ?: "Unknown")
            }
        }
    }

    fun loadMessages() {
        viewModelScope.launch {
            messages = LoadState.Loading
            messages = try {
                val response = api.getMessages()
                _unreadMessages.intValue = response.data.count { !it.read }
                LoadState.Success(response.data)
            } catch (e: Exception) {
                LoadState.Error(e.message ?: "Unknown")
            }
        }
    }

    fun markMessagesRead(ids: List<String>) {
        viewModelScope.launch {
            try {
                api.markMessagesRead(com.afrovision.tv.data.api.model.MarkReadRequest(ids))
                loadMessages()
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "mark read failed", e)
            }
        }
    }

    fun replyToMessage(messageId: String, body: String) {
        viewModelScope.launch {
            try {
                api.replyToMessage(messageId, com.afrovision.tv.data.api.model.ReplyRequest(body))
                loadMessages()
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "reply failed", e)
            }
        }
    }

    fun playVideoUrl(url: String?) {
        if (url.isNullOrBlank()) return
        play(
            PlayerMedia(
                id = url,
                title = "Media",
                streamUrl = url,
                externalUrl = null,
                isLive = false,
                progress = 0,
                duration = 0,
                mediaType = "vod"
            )
        )
    }

    suspend fun createSession(): com.afrovision.tv.data.api.model.TvSessionResponse? {
        return try {
            val deviceId = ensureDeviceId()
            val response = api.createTvSession(
                com.afrovision.tv.data.api.model.TvSessionRequest(
                    deviceId = deviceId,
                    deviceName = deviceName
                )
            )
            pollSessionStatus(response.sessionId)
            response
        } catch (e: Exception) {
            Log.e(TV_APP_TAG, "create session failed", e)
            null
        }
    }

    fun stopSessionPolling() {
        sessionPollJob?.cancel()
        sessionPollJob = null
    }

    private fun pollSessionStatus(sessionId: String) {
        sessionPollJob?.cancel()
        sessionPollJob = viewModelScope.launch {
            var attempts = 0
            while (attempts < 180) {
                delay(5_000)
                try {
                    val status = api.getSessionStatus(sessionId)
                    when (status.status) {
                        "linked" -> {
                            val token = status.token
                            if (!token.isNullOrBlank()) {
                                val name = status.user?.displayName
                                    ?: status.user?.name
                                    ?: status.user?.email
                                    ?: "AfroVision User"
                                activationState = ActivationState.Activated(reactivated = false, ownerName = name)
                                finishPairing(token, name)
                                return@launch
                            }
                        }
                        "expired" -> return@launch
                    }
                } catch (e: Exception) {
                    Log.e(TV_APP_TAG, "poll session failed", e)
                }
                attempts++
            }
        }
    }

    fun resetActivation() {
        activationState = ActivationState.Idle
    }

    fun activate(code: String, ownerName: String, ownerEmail: String, ownerPhone: String) {
        if (activationState is ActivationState.Activating) return
        activationState = ActivationState.Activating
        viewModelScope.launch {
            try {
                val deviceId = ensureDeviceId()
                val response = api.activateTv(
                    com.afrovision.tv.data.api.model.ActivationRequest(
                        code = code.trim().uppercase(),
                        deviceId = deviceId,
                        deviceName = deviceName,
                        ownerName = ownerName.trim(),
                        ownerEmail = ownerEmail.trim().lowercase(),
                        ownerPhone = ownerPhone.trim(),
                        appVersion = appVersion
                    )
                )
                if (response.success && response.deviceToken.isNotBlank()) {
                    val name = response.owner?.name?.takeIf { it.isNotBlank() } ?: ownerName.trim()
                    activationState = ActivationState.Activated(response.reactivated, name)
                    dataStore.setToken(response.deviceToken)
                    dataStore.setPaired(true)
                    dataStore.setUserName(name)
                    _token.value = response.deviceToken
                    TokenHolder.token = response.deviceToken
                    _userName.value = name
                } else {
                    activationState = ActivationState.Error("Activation failed. Please try again.")
                }
            } catch (e: HttpException) {
                val parsed = parseApiError(e)
                Log.e(TV_APP_TAG, "activate failed: ${e.code()} ${parsed.error}")
                activationState = ActivationState.Error(
                    message = parsed.message ?: parsed.error ?: "Activation failed. Please try again.",
                    code = parsed.error
                )
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "activate failed", e)
                activationState = ActivationState.Error("Could not reach AfroVision. Check your internet connection and try again.")
            }
        }
    }

    fun enterAfterActivation() {
        if (_token.value.isBlank()) return
        _isPaired.value = true
        currentScreen = com.afrovision.tv.ui.navigation.Screen.Home
        loadAll()
        startHeartbeat()
        activationState = ActivationState.Idle
    }

    private fun parseApiError(e: HttpException): ApiError {
        return try {
            val body = e.response()?.errorBody()?.string()
            if (body.isNullOrBlank()) ApiError() else errorJson.decodeFromString(ApiError.serializer(), body)
        } catch (_: Exception) {
            ApiError()
        }
    }

    fun loadFeed() {
        viewModelScope.launch {
            feed = LoadState.Loading
            feed = try {
                LoadState.Success(api.getFeed().data)
            } catch (e: Exception) {
                LoadState.Error(e.message ?: "Unknown")
            }
        }
    }

    fun loadProfile() {
        viewModelScope.launch {
            try {
                val user = api.getProfile()
                profile = ProfileState(
                    name = user.name,
                    avatar = user.avatar,
                    tier = user.tier,
                    pairedDeviceCount = user.pairedDeviceCount,
                    posts = user.posts.map { p ->
                        FeedPost(
                            id = p.id,
                            authorName = p.authorName,
                            authorAvatar = p.authorAvatar,
                            time = p.time,
                            body = p.body,
                            mediaUrl = p.mediaUrl
                        )
                    }
                )
                dataStore.setUserName(user.name)
                dataStore.setUserAvatar(user.avatar)
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "profile failed", e)
            }
        }
    }

    fun loadSettings() {
        viewModelScope.launch {
            settings = SettingsState(
                defaultQuality = dataStore.defaultQuality.first(),
                subtitlesOn = dataStore.subtitlesEnabled.first(),
                soundEffects = dataStore.soundEffects.first(),
                hdrPassthrough = dataStore.hdrPassthrough.first(),
                safeArea = dataStore.safeAreaEnabled.first(),
                networkProfile = dataStore.networkProfile.first(),
                autoplay = dataStore.autoplay.first()
            )
        }
    }

    fun updateSettings(settings: SettingsState) {
        this.settings = settings
        viewModelScope.launch {
            dataStore.setDefaultQuality(settings.defaultQuality)
            dataStore.setSubtitlesEnabled(settings.subtitlesOn)
            dataStore.setSoundEffects(settings.soundEffects)
            dataStore.setHdrPassthrough(settings.hdrPassthrough)
            dataStore.setSafeAreaEnabled(settings.safeArea)
            dataStore.setNetworkProfile(settings.networkProfile)
            dataStore.setAutoplay(settings.autoplay)
        }
    }

    fun setDefaultQuality(quality: String) {
        updateSettings(settings.copy(defaultQuality = quality))
    }

    fun setSubtitles(enabled: Boolean) {
        updateSettings(settings.copy(subtitlesOn = enabled))
    }

    fun setAutoplay(enabled: Boolean) {
        updateSettings(settings.copy(autoplay = enabled))
    }

    fun loadDownloads() {
        // Populated by the download tracker; placeholder for now.
        downloads = emptyList()
    }

    fun addDownload(item: DownloadItem) {
        downloads = downloads + item
    }

    fun removeDownload(id: String) {
        downloads = downloads.filter { it.id != id }
    }

    fun signOut() {
        viewModelScope.launch {
            heartbeatJob?.cancel()
            stopSessionPolling()
            dataStore.setToken("")
            dataStore.setPaired(false)
            _token.value = ""
            TokenHolder.token = ""
            _isPaired.value = false
            _userName.value = ""
            activationState = ActivationState.Idle
            currentScreen = com.afrovision.tv.ui.navigation.Screen.Pairing
        }
    }

    fun finishPairing(token: String, name: String) {
        viewModelScope.launch {
            stopSessionPolling()
            dataStore.setToken(token)
            dataStore.setPaired(true)
            dataStore.setUserName(name)
            _token.value = token
            TokenHolder.token = token
            _userName.value = name
        }
    }

    fun retryHeartbeat() {
        viewModelScope.launch { sendHeartbeat() }
    }

    private suspend fun sendHeartbeat() {
        try {
            val response = api.heartbeat(
                com.afrovision.tv.data.api.model.HeartbeatRequest(appVersion = appVersion)
            )
            if (!response.enabled) {
                deviceDisabledReason = response.disabledReason
                    ?: "This TV has been disabled. Contact your distributor."
                return
            }
            deviceDisabledReason = null
            _unreadMessages.intValue = response.unreadMessages
            appUpdate = response.appUpdate?.takeIf { it.latestVersionCode > versionCode && !it.apkUrl.isNullOrBlank() }
        } catch (e: HttpException) {
            if (e.code() == 401 || e.code() == 403) {
                val parsed = parseApiError(e)
                if (parsed.error == "DEVICE_DISABLED") {
                    deviceDisabledReason = parsed.message ?: "This TV has been disabled. Contact your distributor."
                }
            }
            Log.e(TV_APP_TAG, "heartbeat failed: ${e.code()}")
        } catch (e: Exception) {
            Log.e(TV_APP_TAG, "heartbeat failed", e)
        }
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = viewModelScope.launch {
            while (true) {
                sendHeartbeat()
                delay(60_000)
            }
        }
    }

    fun handleDeeplink(uri: Uri?) {
        if (uri == null) return
        val path = uri.path?.trim('/') ?: ""
        when {
            path.startsWith("live") -> {
                loadLiveChannels()
                navigateTo(com.afrovision.tv.ui.navigation.Screen.LiveTv)
            }
            path.startsWith("watch") -> {
                val url = uri.getQueryParameter("url")
                if (!url.isNullOrBlank()) playVideoUrl(url)
            }
            path.startsWith("wave") -> {
                val url = uri.getQueryParameter("url")
                if (!url.isNullOrBlank()) playVideoUrl(url) else navigateTo(com.afrovision.tv.ui.navigation.Screen.Waves)
            }
            path.startsWith("movie") || path.startsWith("movies") -> {
                loadMoviesSeries()
                navigateTo(com.afrovision.tv.ui.navigation.Screen.MoviesSeries)
            }
            path.startsWith("series") -> {
                loadMoviesSeries()
                navigateTo(com.afrovision.tv.ui.navigation.Screen.MoviesSeries)
            }
            path.startsWith("pair") -> {
                navigateTo(com.afrovision.tv.ui.navigation.Screen.Pairing)
            }
            path.startsWith("search") -> {
                val query = uri.getQueryParameter("q") ?: ""
                search(query)
                navigateTo(com.afrovision.tv.ui.navigation.Screen.Search)
            }
            path.startsWith("messages") -> {
                loadMessages()
                navigateTo(com.afrovision.tv.ui.navigation.Screen.Messages)
            }
            path.startsWith("settings") -> {
                navigateTo(com.afrovision.tv.ui.navigation.Screen.Settings)
            }
            path.startsWith("profile") -> {
                loadProfile()
                navigateTo(com.afrovision.tv.ui.navigation.Screen.Profile)
            }
            else -> navigateTo(com.afrovision.tv.ui.navigation.Screen.Home)
        }
    }

    suspend fun ensureDeviceId(): String {
        val stored = dataStore.deviceId.first()
        if (stored.isNotBlank()) {
            deviceId = stored
            return stored
        }
        val id = DeviceIdProvider.getDeviceId(getApplication())
        dataStore.setDeviceId(id)
        deviceId = id
        return id
    }
}

data class ProfileState(
    val name: String = "",
    val avatar: String = "",
    val tier: String = "",
    val pairedDeviceCount: Int = 0,
    val posts: List<FeedPost> = emptyList()
)

data class SettingsState(
    val defaultQuality: String = "auto",
    val subtitlesOn: Boolean = true,
    val soundEffects: Boolean = true,
    val hdrPassthrough: Boolean = false,
    val safeArea: Boolean = true,
    val networkProfile: String = "auto",
    val autoplay: Boolean = false
)

data class DownloadItem(
    val id: String,
    val title: String,
    val mediaType: String,
    val progress: Float = 0f,
    val completed: Boolean = false,
    val localPath: String? = null,
    val status: String = "completed"
)
