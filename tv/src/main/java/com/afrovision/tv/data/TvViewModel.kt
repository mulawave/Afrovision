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
import com.afrovision.tv.data.api.model.HomepageFeaturedItem
import com.afrovision.tv.data.api.model.Message
import com.afrovision.tv.data.api.model.FeedPost
import com.afrovision.tv.data.api.model.Movie
import com.afrovision.tv.data.api.model.Series
import com.afrovision.tv.data.api.model.Wave
import com.afrovision.tv.data.api.model.WatchProgress
import com.afrovision.tv.ui.components.HeroSlide
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
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

/**
 * A raw network exception's message (UnknownHostException, ConnectException,
 * SocketTimeoutException, SSLException...) routinely contains the backend's
 * hostname or IP - OkHttp puts it right in the message text, e.g.
 * "Unable to resolve host \"afrovision-backend-xxxx.run.app\": No address
 * associated with hostname". Passing that straight into LoadState.Error used
 * to be exactly how a bare backend URL ended up on-screen during a network
 * drop. Every catch block should route through this instead of reading a
 * caught exception's message directly, so the backend's address is never
 * something the TV shows.
 */
// Reads the `kind` claim out of a JWT's payload segment without verifying
// its signature - fine here since this only decides which locally-stored
// token slot to backfill, never used to authenticate anything itself (the
// backend independently verifies every token on every request regardless).
private fun jwtKind(token: String): String? {
    return try {
        val parts = token.split(".")
        if (parts.size != 3) return null
        val payload = android.util.Base64.decode(parts[1], android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING or android.util.Base64.NO_WRAP)
        val json = org.json.JSONObject(String(payload, Charsets.UTF_8))
        if (json.has("kind")) json.getString("kind") else null
    } catch (_: Exception) {
        null
    }
}

fun Throwable.toUserFacingMessage(): String = when (this) {
    is java.net.UnknownHostException,
    is java.net.ConnectException,
    is java.net.SocketTimeoutException,
    is javax.net.ssl.SSLException,
    is java.io.IOException -> "Connection dropped. Check your network and try again."
    is retrofit2.HttpException -> "Server error (${code()}). Please try again."
    else -> "Something went wrong. Please try again."
}

data class HomeState(
    val continueWatching: LoadState<List<MediaCard>> = LoadState.Loading,
    val recentChannels: LoadState<List<MediaCard>> = LoadState.Loading,
    val featuredChannels: LoadState<List<com.afrovision.tv.data.api.model.HomepageFeaturedItem>> = LoadState.Loading,
    val liveChannels: LoadState<List<Channel>> = LoadState.Loading,
    val newMovies: LoadState<List<Movie>> = LoadState.Loading,
    val newSeries: LoadState<List<Series>> = LoadState.Loading,
    val waves: LoadState<List<Wave>> = LoadState.Loading,
    val library: LoadState<List<com.afrovision.tv.data.api.model.LibraryItem>> = LoadState.Loading,
    val heroSlides: List<com.afrovision.tv.ui.components.HeroSlide> = com.afrovision.tv.ui.components.defaultHeroSlides(),
    val heroAutoRotateMs: Long = 8000L
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
    val duration: Long = 0L,
    val channelNumber: Int? = null
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

    // "Fav" tab (mobile's _WaveFeedMode.fav) - bookmarked waves, kept
    // separate from the "Public" feed rather than filtering client-side.
    var favWaves by mutableStateOf<LoadState<List<Wave>>>(LoadState.Loading)
        private set

    var moviesSeries by mutableStateOf(MoviesSeriesState())
        private set

    var library by mutableStateOf<LoadState<List<com.afrovision.tv.data.api.model.LibraryItem>>>(LoadState.Loading)
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
            val initWork = async {
                ensureDeviceId()
                _token.value = dataStore.token.first()
                TokenHolder.token = _token.value
                var loadedDeviceToken = dataStore.deviceToken.first()
                // Self-healing for any TV that was activated before the
                // deviceToken/token split existed (see NetworkReconnector-
                // adjacent token fix): back then `token` doubled as the
                // device token. If deviceToken was never persisted but the
                // still-stored `token` is itself a "tv_device"-kind JWT
                // (never QR-paired, so never upgraded to a user token),
                // it's safe to treat it as the device token retroactively -
                // no re-activation needed. If `token` turns out to be a user
                // token instead (already QR-paired under the old broken
                // code), there's nothing to recover from client-side; that
                // TV genuinely needs to go through activation again.
                if (loadedDeviceToken.isBlank() && _token.value.isNotBlank() && jwtKind(_token.value) == "tv_device") {
                    loadedDeviceToken = _token.value
                    dataStore.setDeviceToken(loadedDeviceToken)
                }
                TokenHolder.deviceToken = loadedDeviceToken
                _isPaired.value = dataStore.isPaired.first() && _token.value.isNotBlank()
                _userName.value = dataStore.userName.first()
                if (_isPaired.value) {
                    currentScreen = com.afrovision.tv.ui.navigation.Screen.Home
                    loadAll()
                    startHeartbeat()
                    startChatSocket()
                } else {
                    currentScreen = com.afrovision.tv.ui.navigation.Screen.Pairing
                }
            }
            val minSplash = async { delay(2500) }
            initWork.await()
            minSplash.await()
            _isReady.value = true
        }
    }

    fun navigateTo(screen: com.afrovision.tv.ui.navigation.Screen) {
        if (screen == com.afrovision.tv.ui.navigation.Screen.Player) return
        currentScreen = screen
        if (screen == com.afrovision.tv.ui.navigation.Screen.Home) {
            loadHome()
        }
    }

    fun playHero(slide: com.afrovision.tv.ui.components.HeroSlide) {
        val href = slide.href ?: return
        val isLive = slide.badges.any { it.isLive }
        val isStream = href.endsWith(".m3u8", ignoreCase = true) ||
            href.endsWith(".mp4", ignoreCase = true) ||
            href.endsWith(".mpd", ignoreCase = true)
        val playerMedia = PlayerMedia(
            id = slide.title,
            title = slide.title,
            streamUrl = if (isStream || isLive) href else null,
            externalUrl = if (!isStream && !isLive) href else null,
            isLive = isLive,
            progress = 0,
            duration = 0,
            mediaType = if (isLive) "channel" else "hero"
        )
        play(playerMedia)
    }

    // Where Player was opened from, so closePlayer() can return there instead
    // of a hardcoded screen. Only captured on the *first* play() of a
    // session (currentScreen != Player yet) - a second play() call while
    // already in the player (e.g. selecting a channel-surfer/up-next item)
    // must not overwrite it with Player itself.
    private var screenBeforePlayer: com.afrovision.tv.ui.navigation.Screen? = null

    fun play(media: PlayerMedia) {
        if (currentScreen != com.afrovision.tv.ui.navigation.Screen.Player) {
            screenBeforePlayer = currentScreen
        }
        playerMedia = media
        currentScreen = com.afrovision.tv.ui.navigation.Screen.Player
    }

    fun playChannel(card: MediaCard) {
        viewModelScope.launch {
            dataStore.recordRecentChannel(
                RecentChannel(
                    id = card.id,
                    name = card.title,
                    logoUrl = card.imageUrl,
                    viewedAt = System.currentTimeMillis()
                )
            )
        }
        play(card.toPlayerMedia())
    }

    fun closePlayer() {
        val target = screenBeforePlayer ?: com.afrovision.tv.ui.navigation.Screen.Home
        screenBeforePlayer = null
        playerMedia = null
        navigateTo(target)
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
                LoadState.Error(e.toUserFacingMessage())
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
                LoadState.Error(e.toUserFacingMessage())
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

            // Hero slides + featured channels — from /home/content
            val homepageResult = try {
                val response = api.getHomepageContent()
                val content = response.homepage ?: response.data
                val heroSection = content?.sections?.find { it.key == "hero" && it.enabled }
                val heroSlides = heroSection?.toHeroSlides()
                val autoRotate = heroSection?.autoRotateMs ?: 8000L
                val featuredSection = content?.sections?.find { it.key == "featured_channels" && it.enabled }
                val featuredItems = featuredSection?.items ?: emptyList()
                Log.d(TV_APP_TAG, "Homepage loaded: ${heroSlides?.size ?: 0} hero slides, ${featuredItems.size} featured channels")
                Triple(heroSlides ?: com.afrovision.tv.ui.components.defaultHeroSlides(), autoRotate, featuredItems)
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "getHomepageContent failed", e)
                Triple(com.afrovision.tv.ui.components.defaultHeroSlides(), 8000L, emptyList<HomepageFeaturedItem>())
            }

            // Recently viewed channels — from local DataStore
            val recentChannelList = try {
                val recent = dataStore.recentChannels.first()
                Log.d(TV_APP_TAG, "Home recent channels from DataStore: ${recent.size} items")
                recent.map { rc ->
                    MediaCard(
                        id = rc.id,
                        title = rc.name,
                        imageUrl = rc.logoUrl,
                        mediaType = "channel",
                        badge = "LIVE"
                    )
                }
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "Home recent channels load FAILED", e)
                emptyList()
            }

            // Each endpoint loads independently — one failure does NOT kill all rails
            val progressResult = try {
                val r = api.getWatchProgress()
                Log.d(TV_APP_TAG, "Home /watch-progress/me: ${r.data.size} items")
                r
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "Home /watch-progress/me FAILED", e)
                null
            }

            val liveResult = try {
                val r = api.getChannels(mapOf("live" to "true"))
                Log.d(TV_APP_TAG, "Home /channels?live=true: ${r.channels.size} items")
                r
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "Home /channels?live=true FAILED", e)
                null
            }

            val moviesResult = try {
                val r = api.getMovies(mapOf("sort" to "new"))
                Log.d(TV_APP_TAG, "Home /movies?sort=new: ${r.movies.size} items")
                r
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "Home /movies?sort=new FAILED", e)
                null
            }

            val seriesResult = try {
                val r = api.getSeries(mapOf("sort" to "new"))
                Log.d(TV_APP_TAG, "Home /series?sort=new: ${r.series.size} items")
                r
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "Home /series?sort=new FAILED", e)
                null
            }

            val wavesResult = try {
                val r = api.getWaves(mapOf("limit" to "12"))
                Log.d(TV_APP_TAG, "Home /wave?limit=12: ${r.data.size} items")
                r
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "Home /wave?limit=12 FAILED", e)
                null
            }

            val libraryResult = try {
                val r = api.getLibraryFeed(mapOf("limit" to "20"))
                Log.d(TV_APP_TAG, "Home /library/feed: ${r.data.items.size} items")
                r
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "Home /library/feed FAILED", e)
                null
            }

            // Build continue-watching cards from whatever loaded successfully.
            // Library items are reading content, not video - they have no
            // watch progress and don't belong in this map.
            val mediaById = buildMap<String, Any> {
                liveResult?.channels?.forEach { put(it.id, it) }
                moviesResult?.movies?.forEach { put(it.id, it) }
                seriesResult?.series?.forEach { put(it.id, it) }
                wavesResult?.data?.forEach { put(it.id, it) }
            }
            val continueCards = progressResult?.data?.mapNotNull { wp ->
                when (val media = mediaById[wp.mediaId]) {
                    is Channel -> wp.toMediaCard(media)
                    is Movie -> wp.toMediaCard(media)
                    is Series -> wp.toMediaCard(media)
                    is Wave -> wp.toMediaCard(media)
                    else -> wp.toMediaCard()
                }
            } ?: emptyList()
            Log.d(TV_APP_TAG, "Home continue-watching enriched: ${continueCards.size} cards")

            val newState = homeState.copy(
                continueWatching = if (progressResult != null) LoadState.Success(continueCards) else LoadState.Error("Failed"),
                recentChannels = LoadState.Success(recentChannelList),
                featuredChannels = LoadState.Success(homepageResult.third),
                liveChannels = if (liveResult != null) LoadState.Success(liveResult.channels.filter { !it.isExclusive }) else LoadState.Error("Failed"),
                newMovies = if (moviesResult != null) LoadState.Success(moviesResult.movies) else LoadState.Error("Failed"),
                newSeries = if (seriesResult != null) LoadState.Success(seriesResult.series) else LoadState.Error("Failed"),
                waves = if (wavesResult != null) LoadState.Success(wavesResult.data) else LoadState.Error("Failed"),
                library = if (libraryResult != null) LoadState.Success(libraryResult.data.items) else LoadState.Error("Failed"),
                heroSlides = homepageResult.first,
                heroAutoRotateMs = homepageResult.second
            )
            homeState = newState
            Log.d(TV_APP_TAG, "Home state assembled: recent=${recentChannelList.size} featured=${homepageResult.third.size} continue=${continueCards.size} live=${liveResult?.channels?.size ?: 0} movies=${moviesResult?.movies?.size ?: 0} series=${seriesResult?.series?.size ?: 0} waves=${wavesResult?.data?.size ?: 0} library=${libraryResult?.data?.items?.size ?: 0}")

            if (progressResult != null) {
                RecommendationManager.sync(getApplication(), continueCards)
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
                LoadState.Error(e.toUserFacingMessage())
            }
        }
    }

    // Paged like mobile's own feed: a full library can be 60+ waves, so
    // fetching a flat 24 and looping just that batch forever made it look
    // like there were only ever a handful of waves. wavesNextCursor tracks
    // whether more exist; the Waves screen calls loadMoreWaves() as the
    // user approaches the end of what's currently loaded, appending rather
    // than replacing, and only wraps back to the start once this is null.
    var wavesNextCursor by mutableStateOf<String?>(null)
        private set
    var wavesLoadingMore by mutableStateOf(false)
        private set

    var marqueeTopics by mutableStateOf<LoadState<List<String>>>(LoadState.Loading)
        private set

    /** Same public ticker feed the mobile app and website use, filtered client-side to `active` topics - mirrors HomeService.getMarqueeTopics. */
    fun loadMarqueeTopics() {
        viewModelScope.launch {
            marqueeTopics = try {
                LoadState.Success(api.getMarqueeTopics().filter { it.active }.map { it.text })
            } catch (e: Exception) {
                LoadState.Error(e.toUserFacingMessage())
            }
        }
    }

    fun loadWaves() {
        viewModelScope.launch {
            waves = LoadState.Loading
            waves = try {
                val response = api.getWaves(mapOf("limit" to "24"))
                wavesNextCursor = response.nextCursor
                LoadState.Success(response.waves.ifEmpty { response.data })
            } catch (e: Exception) {
                LoadState.Error(e.toUserFacingMessage())
            }
        }
    }

    fun loadMoreWaves() {
        val cursor = wavesNextCursor ?: return
        if (wavesLoadingMore) return
        val current = (waves as? LoadState.Success)?.data ?: return
        wavesLoadingMore = true
        viewModelScope.launch {
            try {
                // /wave/feed is a "novel" discovery feed, not a strict
                // chronological list - its diversity/novelty ranking can
                // legitimately resurface the same waves on a later page if
                // it doesn't know what's already been shown. exclude_ids is
                // the mechanism the backend actually exposes for this
                // (parseExcludeIdsFromQuery, capped at 160): without it,
                // "page 2" kept coming back full of waves already in
                // `current`, which the client-side dedupe below then
                // silently dropped - net near-zero new waves added, so
                // pagination looked broken even though the calls succeeded.
                val existingIds = current.map { it.id }
                val query = mutableMapOf("limit" to "24", "cursor" to cursor)
                if (existingIds.isNotEmpty()) {
                    query["exclude_ids"] = existingIds.takeLast(160).joinToString(",")
                }
                val response = api.getWaves(query)
                val more = response.waves.ifEmpty { response.data }
                val existingIdSet = existingIds.toHashSet()
                waves = LoadState.Success(current + more.filterNot { it.id in existingIdSet })
                wavesNextCursor = response.nextCursor
            } catch (e: Exception) {
                Log.w(TV_APP_TAG, "loadMoreWaves failed", e)
            } finally {
                wavesLoadingMore = false
            }
        }
    }

    fun loadFavWaves() {
        viewModelScope.launch {
            favWaves = LoadState.Loading
            favWaves = try {
                LoadState.Success(api.getWaveBookmarks())
            } catch (e: Exception) {
                LoadState.Error(e.toUserFacingMessage())
            }
        }
    }

    // Single tap = intensity 1, matching mobile's baseline tap (mobile also
    // supports press-and-hold up to intensity 3, not replicated here - a
    // remote's single Enter press is the TV-appropriate equivalent).
    // Pulse is not a one-time "like" - mobile lets a viewer tap it repeatedly
    // to mark favorite moments along the wave's own timeline (that's what
    // the ECG/pulse-moments graph visualizes), capped server-side at a daily
    // limit per wave (Wave.addPulse returns null / this call gets HTTP 429
    // once hit). momentSecondsProvider is called at request time (not
    // capture time) so the moment recorded is wherever playback actually is
    // when the call goes out, not when the button was first pressed.
    fun addWavePulse(waveId: String, momentSeconds: Long, onResult: (limitReached: Boolean) -> Unit) {
        viewModelScope.launch {
            try {
                api.addWavePulse(waveId, mapOf("intensity" to 1, "moment_seconds" to momentSeconds.toInt()))
                onResult(false)
                loadPulseMomentsForce(waveId)
            } catch (e: HttpException) {
                if (e.code() == 429) onResult(true) else onResult(false)
            } catch (e: Exception) {
                Log.w(TV_APP_TAG, "addWavePulse failed for $waveId", e)
                onResult(false)
            }
        }
    }

    private fun loadPulseMomentsForce(waveId: String) {
        viewModelScope.launch {
            try {
                val response = api.getWavePulseMoments(waveId)
                pulseMomentsByWaveId = pulseMomentsByWaveId + (waveId to response.moments)
            } catch (e: Exception) {
                Log.w(TV_APP_TAG, "loadPulseMomentsForce failed for $waveId", e)
            }
        }
    }

    fun toggleWaveBookmark(waveId: String, onResult: (Boolean) -> Unit) {
        viewModelScope.launch {
            try {
                val status = api.toggleWaveBookmark(waveId)
                onResult(status.bookmarked)
            } catch (e: Exception) {
                Log.w(TV_APP_TAG, "toggleWaveBookmark failed for $waveId", e)
            }
        }
    }

    // Mirrors mobile's WaveService.trackView calls exactly: once when a wave
    // becomes the one on screen, and again every time it loops back to the
    // start - the backend (Wave.trackView) already dedupes views_count to
    // once per user/device on its own, while repeat_play_count always
    // increments, so there's no need to debounce anything client-side.
    // Cached for the life of the ViewModel - once a wave's pulse moments are
    // fetched they never change meaningfully within a session, so revisiting
    // a wave (or landing back on it after browsing others) must not re-pull
    // this from the server.
    var pulseMomentsByWaveId by mutableStateOf<Map<String, List<com.afrovision.tv.data.api.model.WavePulseMoment>>>(emptyMap())
        private set

    fun loadPulseMoments(waveId: String) {
        if (pulseMomentsByWaveId.containsKey(waveId)) return
        viewModelScope.launch {
            try {
                val response = api.getWavePulseMoments(waveId)
                pulseMomentsByWaveId = pulseMomentsByWaveId + (waveId to response.moments)
            } catch (e: Exception) {
                Log.w(TV_APP_TAG, "loadPulseMoments failed for $waveId", e)
            }
        }
    }

    fun trackWaveView(waveId: String) {
        viewModelScope.launch {
            try {
                api.trackWaveView(waveId)
            } catch (e: Exception) {
                Log.w(TV_APP_TAG, "trackWaveView failed for $waveId", e)
            }
        }
    }

    // A poster tap should open a details screen (poster, synopsis, Play
    // button) - the same as mobile - not start playback immediately.
    // selectedMovie/selectedSeries themselves already existed (unused,
    // alongside the equally-unused Screen.MovieDetail/SeriesDetail enum
    // entries) - this is what they were for.
    fun selectMovie(movie: Movie) { selectedMovie = movie }
    fun clearSelectedMovie() { selectedMovie = null }
    fun selectSeries(series: Series) { selectedSeries = series }
    fun clearSelectedSeries() { selectedSeries = null }

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
                    movies = LoadState.Success(movies.movies),
                    series = LoadState.Success(series.series)
                )
            } catch (e: Exception) {
                moviesSeries = moviesSeries.copy(
                    movies = LoadState.Error(e.toUserFacingMessage()),
                    series = LoadState.Error(e.toUserFacingMessage())
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
                LoadState.Success(api.getLibraryFeed(mapOf("limit" to "40")).data.items)
            } catch (e: Exception) {
                LoadState.Error(e.toUserFacingMessage())
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
                LoadState.Error(e.toUserFacingMessage())
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
                val movies = api.getMovies(mapOf("q" to query)).movies
                val series = api.getSeries(mapOf("q" to query)).series
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
                search = LoadState.Error(e.toUserFacingMessage())
            }
        }
    }

    fun loadMessages() {
        viewModelScope.launch {
            messages = LoadState.Loading
            messages = try {
                // Nav badge intentionally not touched here - it's chat +
                // admin combined and heartbeat is its one authoritative
                // source (see sendHeartbeat). Setting it from admin-only
                // unread count on every Inbox open would clobber that
                // combined total back down to just the admin portion.
                val response = api.getMessages()
                LoadState.Success(response.data)
            } catch (e: Exception) {
                LoadState.Error(e.toUserFacingMessage())
            }
        }
    }

    fun markMessagesRead(ids: List<String>) {
        viewModelScope.launch {
            try {
                api.markMessagesRead(com.afrovision.tv.data.api.model.MarkReadRequest(ids))
                loadMessages()
                retryHeartbeat()
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

    // ── Library reader (mirrors the website's channel-scoped reader) ──

    var continueReading by mutableStateOf<LoadState<List<com.afrovision.tv.data.api.model.ContinueReadingRecord>>>(LoadState.Loading)
    var readerDetail by mutableStateOf<LoadState<com.afrovision.tv.data.api.model.LibraryItemDetail>>(LoadState.Loading)
    var readerManifest by mutableStateOf<LoadState<com.afrovision.tv.data.api.model.ReaderManifest>>(LoadState.Loading)
    var readerChannelId by mutableStateOf<String?>(null)
    var readerItemId by mutableStateOf<String?>(null)
    private var progressSaveJob: Job? = null

    fun openReaderScreen(channelId: String, itemId: String) {
        readerChannelId = channelId
        readerItemId = itemId
        currentScreen = com.afrovision.tv.ui.navigation.Screen.Reader
        openReader(channelId, itemId)
    }

    fun closeReader() {
        currentScreen = com.afrovision.tv.ui.navigation.Screen.Library
        readerChannelId = null
        readerItemId = null
    }

    fun loadContinueReading() {
        viewModelScope.launch {
            continueReading = try {
                LoadState.Success(api.getContinueReading(12).data)
            } catch (e: Exception) {
                LoadState.Error(e.toUserFacingMessage())
            }
        }
    }

    fun openReaderItem(channelId: String, itemId: String) {
        readerItemId = itemId
        openReader(channelId, itemId)
    }

    fun openReader(channelId: String, itemId: String) {
        readerDetail = LoadState.Loading
        readerManifest = LoadState.Loading
        viewModelScope.launch {
            readerDetail = try {
                LoadState.Success(api.getLibraryItemDetail(channelId, itemId).data)
            } catch (e: Exception) {
                LoadState.Error(e.toUserFacingMessage())
            }
        }
        viewModelScope.launch {
            readerManifest = try {
                val info = api.getLibraryReaderManifestInfo(channelId, itemId).data
                val manifest = com.afrovision.tv.data.api.ReaderManifestFetcher.fetch(info.manifestUrl)
                if (manifest != null) LoadState.Success(manifest) else LoadState.Error("Could not load book pages")
            } catch (e: Exception) {
                LoadState.Error(e.toUserFacingMessage())
            }
        }
    }

    /** Debounced autosave, matching the website reader's 450ms debounce. */
    fun saveReaderProgress(channelId: String, itemId: String, progress: com.afrovision.tv.data.api.model.LibraryProgress) {
        progressSaveJob?.cancel()
        progressSaveJob = viewModelScope.launch {
            delay(450)
            try {
                api.putLibraryProgress(channelId, itemId, progress)
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "saveReaderProgress failed", e)
            }
        }
    }

    // ── Exclusive (movies/series/library, per accessible exclusive channel) ──

    var exclusiveMovies by mutableStateOf<LoadState<List<Movie>>>(LoadState.Loading)
    var exclusiveSeries by mutableStateOf<LoadState<List<Series>>>(LoadState.Loading)
    var exclusiveLibrary by mutableStateOf<LoadState<List<com.afrovision.tv.data.api.model.LibraryItem>>>(LoadState.Loading)
    var exclusiveAccess by mutableStateOf<LoadState<com.afrovision.tv.data.api.model.ExclusiveAccessSummary>>(LoadState.Loading)
    // Every exclusive channel the device can see, regardless of membership -
    // needed (alongside exclusiveAccess/channelSubscriptions) to work out
    // which exclusive channels the user is NOT a member of yet, for the
    // "Request/Purchase membership" info card mobile shows per channel.
    var exclusiveChannels by mutableStateOf<LoadState<List<Channel>>>(LoadState.Loading)
    // Full membership history (active + expired), from the real user-JWT
    // endpoint - the device-token exclusiveAccess summary above only ever
    // returns active memberships, so it can't tell "never subscribed" apart
    // from "subscribed, now expired," which is what the Renew card needs.
    var channelSubscriptions by mutableStateOf<LoadState<List<com.afrovision.tv.data.api.model.ChannelSubscription>>>(LoadState.Loading)

    fun loadExclusiveAccess() {
        viewModelScope.launch {
            exclusiveAccess = LoadState.Loading
            try {
                exclusiveAccess = LoadState.Success(api.getExclusiveAccessSummary())
            } catch (e: Exception) {
                exclusiveAccess = LoadState.Error(e.toUserFacingMessage())
            }
        }
    }

    fun loadChannelSubscriptions() {
        viewModelScope.launch {
            channelSubscriptions = try {
                LoadState.Success(api.getChannelSubscriptions().subscriptions)
            } catch (e: Exception) {
                // Expected/benign for a device that only ever activated and
                // never signed in to a real account - this endpoint needs a
                // real user JWT, which such a device doesn't have.
                LoadState.Success(emptyList())
            }
        }
    }

    fun loadExclusiveContent() {
        viewModelScope.launch {
            exclusiveMovies = LoadState.Loading
            exclusiveSeries = LoadState.Loading
            exclusiveLibrary = LoadState.Loading
            exclusiveChannels = LoadState.Loading
            try {
                val channels = api.getTvChannels().let { it.channels.ifEmpty { it.data } }
                val exclusiveChannelIds = channels.filter { it.isExclusive }.map { it.id }
                exclusiveChannels = LoadState.Success(channels.filter { it.isExclusive })

                if (exclusiveChannelIds.isEmpty()) {
                    exclusiveMovies = LoadState.Success(emptyList())
                    exclusiveSeries = LoadState.Success(emptyList())
                    exclusiveLibrary = LoadState.Success(emptyList())
                    return@launch
                }

                val movies = exclusiveChannelIds.flatMap { channelId ->
                    try {
                        api.getExclusiveChannelMovies(channelId).data.movies
                    } catch (e: Exception) {
                        Log.e(TV_APP_TAG, "exclusive movies failed for $channelId", e)
                        emptyList()
                    }
                }
                val series = exclusiveChannelIds.flatMap { channelId ->
                    try {
                        api.getExclusiveChannelSeries(channelId).data.series
                    } catch (e: Exception) {
                        Log.e(TV_APP_TAG, "exclusive series failed for $channelId", e)
                        emptyList()
                    }
                }
                val library = exclusiveChannelIds.flatMap { channelId ->
                    try {
                        api.getExclusiveChannelLibrary(channelId).data.items
                    } catch (e: Exception) {
                        Log.e(TV_APP_TAG, "exclusive library failed for $channelId", e)
                        emptyList()
                    }
                }

                exclusiveMovies = LoadState.Success(movies)
                exclusiveSeries = LoadState.Success(series)
                exclusiveLibrary = LoadState.Success(library)
            } catch (e: Exception) {
                exclusiveMovies = LoadState.Error(e.toUserFacingMessage())
                exclusiveSeries = LoadState.Error(e.toUserFacingMessage())
                exclusiveLibrary = LoadState.Error(e.toUserFacingMessage())
            }
        }
    }

    // ── TV-to-TV chat ────────────────────────────────────────────

    var chatPin by mutableStateOf<String?>(null)
    var chatConnections by mutableStateOf<LoadState<List<com.afrovision.tv.data.api.model.ChatConnection>>>(LoadState.Loading)
    var chatConnectError by mutableStateOf<String?>(null)
    var chatMessages by mutableStateOf<LoadState<List<com.afrovision.tv.data.api.model.ChatMessage>>>(LoadState.Loading)
    private var openChatConnectionId: String? = null

    /**
     * Live delivery for chat (see chat/ChatSocket.kt): a badge nudge just
     * re-runs the heartbeat, which is where the authoritative combined
     * unread count (admin messages + chat) already gets computed server
     * side - no separate counting logic to keep in sync here. A message
     * nudge only refetches if that conversation is the one currently open.
     */
    private fun startChatSocket() {
        val token = TokenHolder.deviceToken
        if (token.isBlank()) return
        com.afrovision.tv.chat.ChatSocket.connect(
            deviceToken = token,
            onBadgeChanged = { retryHeartbeat() },
            onMessageForConnection = { connectionId ->
                if (connectionId == openChatConnectionId) loadChatMessages(connectionId)
            }
        )
    }

    fun openChatConnection(connectionId: String) {
        val previous = openChatConnectionId
        if (previous != null && previous != connectionId) {
            com.afrovision.tv.chat.ChatSocket.leaveConnection(previous)
        }
        openChatConnectionId = connectionId
        com.afrovision.tv.chat.ChatSocket.joinConnection(connectionId)
        loadChatMessages(connectionId)
        markChatConnectionRead(connectionId)
    }

    fun closeChatConnection() {
        openChatConnectionId?.let { com.afrovision.tv.chat.ChatSocket.leaveConnection(it) }
        openChatConnectionId = null
    }

    private fun markChatConnectionRead(connectionId: String) {
        viewModelScope.launch {
            try {
                api.markChatConnectionRead(connectionId)
                retryHeartbeat()
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "markChatConnectionRead failed", e)
            }
        }
    }

    fun loadChatPin() {
        viewModelScope.launch {
            try {
                chatPin = api.getChatPin().pin
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "loadChatPin failed", e)
            }
        }
    }

    fun regenerateChatPin() {
        viewModelScope.launch {
            try {
                chatPin = api.regenerateChatPin().pin
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "regenerateChatPin failed", e)
            }
        }
    }

    fun loadChatConnections() {
        viewModelScope.launch {
            chatConnections = LoadState.Loading
            chatConnections = try {
                LoadState.Success(api.listChatConnections().connections)
            } catch (e: Exception) {
                LoadState.Error(e.toUserFacingMessage())
            }
        }
    }

    fun connectByChatPin(pin: String) {
        viewModelScope.launch {
            chatConnectError = null
            try {
                api.requestChatConnection(com.afrovision.tv.data.api.model.ChatConnectRequest(pin))
                loadChatConnections()
            } catch (e: HttpException) {
                chatConnectError = parseApiError(e).message ?: "Could not connect with that PIN."
            } catch (e: Exception) {
                chatConnectError = e.toUserFacingMessage()
            }
        }
    }

    fun respondToChatConnection(connectionId: String, accept: Boolean) {
        viewModelScope.launch {
            try {
                api.respondToChatConnection(connectionId, com.afrovision.tv.data.api.model.ChatRespondRequest(accept))
                loadChatConnections()
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "respondToChatConnection failed", e)
            }
        }
    }

    fun loadChatMessages(connectionId: String) {
        viewModelScope.launch {
            chatMessages = try {
                LoadState.Success(api.listChatMessages(connectionId).messages)
            } catch (e: Exception) {
                LoadState.Error(e.toUserFacingMessage())
            }
        }
    }

    fun sendChatMessage(connectionId: String, body: String) {
        viewModelScope.launch {
            try {
                api.sendChatMessage(connectionId, com.afrovision.tv.data.api.model.ChatSendRequest(body))
                loadChatMessages(connectionId)
            } catch (e: Exception) {
                Log.e(TV_APP_TAG, "sendChatMessage failed", e)
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

    fun activate(
        code: String,
        ownerName: String,
        ownerEmail: String,
        ownerPhone: String,
        mode: String = "register",
        ownerPassword: String? = null
    ) {
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
                        mode = mode,
                        ownerName = ownerName.trim(),
                        ownerEmail = ownerEmail.trim().lowercase(),
                        ownerPhone = ownerPhone.trim(),
                        ownerPassword = ownerPassword,
                        appVersion = appVersion
                    )
                )
                if (response.success && response.deviceToken.isNotBlank()) {
                    val name = response.owner?.name?.takeIf { it.isNotBlank() } ?: ownerName.trim()
                    activationState = ActivationState.Activated(response.reactivated, name)
                    dataStore.setDeviceToken(response.deviceToken)
                    TokenHolder.deviceToken = response.deviceToken
                    // Backend now issues a real user-kind JWT for the linked
                    // account alongside the device token (both sign-in and
                    // register - a freshly registered account is a real
                    // account too), so activation alone gets personalized
                    // content working immediately, same as QR pairing's
                    // finishPairing used to be the only way to achieve.
                    val generalToken = response.userToken?.takeIf { it.isNotBlank() } ?: response.deviceToken
                    dataStore.setToken(generalToken)
                    dataStore.setPaired(true)
                    dataStore.setUserName(name)
                    _token.value = generalToken
                    TokenHolder.token = generalToken
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
        startChatSocket()
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
                LoadState.Error(e.toUserFacingMessage())
            }
        }
    }

    fun loadProfile() {
        viewModelScope.launch {
            try {
                val user = api.getProfile().user
                profile = ProfileState(
                    name = user.name,
                    avatar = user.avatar,
                    tier = user.tier,
                    isPremiumCreator = user.isPremiumCreator,
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
                soundVolume = dataStore.soundVolume.first(),
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
            dataStore.setSoundVolume(settings.soundVolume)
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

    fun setSoundEffects(enabled: Boolean) {
        updateSettings(settings.copy(soundEffects = enabled))
    }

    fun setSoundVolume(volume: Float) {
        updateSettings(settings.copy(soundVolume = volume))
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
            com.afrovision.tv.chat.ChatSocket.disconnect()
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
    val isPremiumCreator: Boolean = false,
    val pairedDeviceCount: Int = 0,
    val posts: List<FeedPost> = emptyList()
)

data class SettingsState(
    val defaultQuality: String = "auto",
    val subtitlesOn: Boolean = true,
    val soundEffects: Boolean = true,
    val soundVolume: Float = 0.5f,
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
