package com.afrovision.tv.data.api.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// A channel is exclusive when its type is "exclusive" - the same single
// rule the backend uses (utils/exclusive-access-helper.js isExclusiveChannel).
// The monthly fee is a property of an exclusive channel, not what makes it one.
@Serializable
data class Channel(
    val id: String = "",
    val name: String = "",
    val description: String? = null,
    val category: String? = null,
    val type: String = "public",
    @SerialName("logo_url") val posterUrl: String? = null,
    @SerialName("channel_number") val channelNumber: Int? = null,
    @SerialName("is_live") val isLive: Boolean = false,
    @SerialName("exclusive_monthly_fee_ngn") val exclusiveMonthlyFeeNgn: Double = 0.0,
    @SerialName("external_url") val externalUrl: String? = null,
    @SerialName("stream_url") val rawStreamUrl: String? = null,
    // What the channel enrichers actually emit for external-source channels
    // (channel.controller.js). Nothing ever sends `stream_url`, so reading
    // only that left every channel without a URL.
    @SerialName("resolved_playback_url") val resolvedPlaybackUrl: String? = null,
    // "native" channels have no URL of their own - they play whatever the
    // broadcast scheduler says is on now (GET /broadcast/now-playing/:id).
    @SerialName("stream_source_mode") val streamSourceMode: String = "native",
    // Result of the backend's stream health check (channel.controller.js):
    // valid | offline | invalid | access_denied | unknown.
    @SerialName("stream_status") val streamStatus: String = "unknown"
) {
    val isExclusive: Boolean get() = type == "exclusive"
    // External streams the health check has already found broken. Listing
    // them just sent viewers into a tune that could never succeed.
    val isKnownBroken: Boolean get() =
        streamSourceMode != "native" && streamStatus in setOf("offline", "invalid", "access_denied")
    val streamUrl: String? get() = resolvedPlaybackUrl ?: rawStreamUrl
}

@Serializable
data class ChannelListResponse(
    val channels: List<Channel> = emptyList(),
    val data: List<Channel> = emptyList()
)

@Serializable
data class ChannelDetailResponse(
    val channel: Channel? = null,
    val data: Channel? = null
)

// There is no `stream_url` field on a movie at all - the backend stores
// `video_source_mode` (hosted|external_url|embed|hls) plus one URL field
// per mode (movie.model.js). The old `stream_url` mapping bound to nothing
// and was always null, which is why a movie could sit "tuning in" forever:
// the player had no URL to ever actually load. `streamUrl` here mirrors
// mobile's MovieModel.playbackUrl getter exactly - same mode-to-field
// switch, so both apps pick the same URL for the same movie.
@Serializable
data class Movie(
    val id: String = "",
    val title: String = "",
    val description: String? = null,
    @SerialName("poster_url") val posterUrl: String? = null,
    @SerialName("video_source_mode") val videoSourceMode: String = "hosted",
    @SerialName("hosted_url") val hostedUrl: String? = null,
    @SerialName("hls_url") val hlsUrl: String? = null,
    @SerialName("embed_url") val embedUrl: String? = null,
    @SerialName("external_url") val externalUrl: String? = null,
    val duration: Int? = null,
    @SerialName("total_views") val totalViews: Long = 0,
    @SerialName("published_at") val publishedAt: Long? = null,
    @SerialName("created_at") val createdAt: Long? = null
) {
    val streamUrl: String? get() = when (videoSourceMode) {
        "hls" -> hlsUrl
        "external_url" -> externalUrl
        "embed" -> embedUrl
        else -> hostedUrl
    }
}

// The real GET /movies response is { success, data: { movies: [...], pagination } }
// (movie-viewer.controller.js: listPublicMovies) - `data` is a nested
// object, not a flat array. The old shape here (`data: List<Movie>`) could
// never actually deserialize; every call silently threw and was caught,
// which is why Home's movie rail, the Movies & Series screen, and search
// all quietly failed - Movies & Series just happened to show it as a
// permanent "Loading…" since it had no error-vs-loading distinction.
@Serializable
data class MovieListResponse(
    val data: MovieListData = MovieListData()
) {
    val movies: List<Movie> get() = data.movies
}

@Serializable
data class MovieListData(
    val movies: List<Movie> = emptyList()
)

@Serializable
data class Series(
    val id: String = "",
    val title: String = "",
    val description: String? = null,
    // The backend stores a series' cover under `cover_url`, not
    // `poster_url` (series.model.js) - `poster_url` is a different field
    // used elsewhere (e.g. seasons/episodes). This was silently mapping to
    // nothing for every series on every screen that renders one.
    @SerialName("cover_url") val posterUrl: String? = null,
    // Needed for the channel-scoped detail route - there is no global
    // GET /series/:id (series.routes.js).
    @SerialName("channel_id") val channelId: String? = null,
    val seasons: List<Season> = emptyList(),
    @SerialName("published_at") val publishedAt: Long? = null,
    @SerialName("created_at") val createdAt: Long? = null
)

@Serializable
data class Season(
    val id: String = "",
    @SerialName("season_number") val number: Int = 0,
    val episodes: List<Episode> = emptyList()
)

// Same real shape as Movie - no `stream_url` field, same
// video_source_mode + per-mode URL fields (series.model.js episode shape).
@Serializable
data class Episode(
    val id: String = "",
    val title: String = "",
    @SerialName("synopsis") val description: String? = null,
    @SerialName("episode_number") val number: Int = 0,
    @SerialName("video_source_mode") val videoSourceMode: String = "hosted",
    @SerialName("hosted_url") val hostedUrl: String? = null,
    @SerialName("hls_url") val hlsUrl: String? = null,
    @SerialName("embed_url") val embedUrl: String? = null,
    @SerialName("external_url") val externalUrl: String? = null,
    val duration: Int? = null
) {
    val streamUrl: String? get() = when (videoSourceMode) {
        "hls" -> hlsUrl
        "external_url" -> externalUrl
        "embed" -> embedUrl
        else -> hostedUrl
    }
}

// Same real shape as MovieListResponse - GET /series returns
// { success, data: { series: [...], pagination } } (series-viewer.controller.js).
@Serializable
data class SeriesListResponse(
    val data: SeriesListData = SeriesListData()
) {
    val series: List<Series> get() = data.series
}

@Serializable
data class SeriesListData(
    val series: List<Series> = emptyList()
)

@Serializable
data class Wave(
    val id: String = "",
    val title: String = "",
    val description: String? = null,
    @SerialName("thumbnail_url") val thumbnailUrl: String? = null,
    @SerialName("video_url") val streamUrl: String? = null,
    @SerialName("external_url") val externalUrl: String? = null,
    @SerialName("creator_uid") val creatorId: String? = null,
    @SerialName("channel_name") val creatorName: String? = null,
    @SerialName("views_count") val viewsCount: Long = 0,
    @SerialName("pulse_count") val pulseCount: Long = 0,
    @SerialName("repeat_play_count") val repeatPlayCount: Long = 0,
    @SerialName("comment_count") val commentCount: Long = 0,
    @SerialName("is_bookmarked") val isBookmarked: Boolean = false,
    val duration: Long = 0,
    // Sent with every wave (wave.controller.js). Exclusive waves are kept
    // off the public Waves screen and shown only in Exclusive.
    @SerialName("channel_type") val channelType: String = "public"
) {
    val isExclusive: Boolean get() = channelType == "exclusive"
}

@Serializable
data class WavePulseMoment(
    val second: Int = 0,
    @SerialName("intensity_sum") val intensitySum: Int = 0
)

@Serializable
data class WavePulseMomentsResponse(
    val moments: List<WavePulseMoment> = emptyList(),
    val duration: Long = 0
)

@Serializable
data class WaveBookmarkStatus(
    val bookmarked: Boolean = false
)

@Serializable
data class WaveListResponse(
    val waves: List<Wave> = emptyList(),
    val data: List<Wave> = emptyList(),
    @SerialName("next_cursor") val nextCursor: String? = null
)

@Serializable
data class WatchProgress(
    @SerialName("media_type") val mediaType: String = "",
    @SerialName("channel_id") val channelId: String? = null,
    @SerialName("movie_id") val movieId: String? = null,
    @SerialName("series_id") val seriesId: String? = null,
    @SerialName("episode_id") val episodeId: String? = null,
    val title: String = "",
    @SerialName("episode_title") val episodeTitle: String? = null,
    @SerialName("poster_url") val posterUrl: String? = null,
    @SerialName("position_seconds") val positionSeconds: Long = 0,
    @SerialName("duration_seconds") val durationSeconds: Long = 0,
    @SerialName("updated_at") val updatedAt: Long = 0
)

@Serializable
data class WatchProgressData(
    val items: List<WatchProgress> = emptyList()
)

@Serializable
data class WatchProgressResponse(
    val success: Boolean = false,
    val data: WatchProgressData = WatchProgressData()
)

// Body of PUT /watch-progress/:mediaType/:mediaId (progress.controller.js).
@Serializable
data class WatchProgressUpdate(
    @SerialName("position_seconds") val positionSeconds: Long,
    @SerialName("duration_seconds") val durationSeconds: Long
)

// GET /movies/:movieId -> { success, data: { movie } }. Unlike the list
// endpoint, the detail route resolves hosted/HLS URLs to playable ones.
@Serializable
data class MovieDetailResponse(val data: MovieDetailData = MovieDetailData())

@Serializable
data class MovieDetailData(val movie: Movie? = null)

// GET /channels/:channelId/series/:seriesId -> { success, data: { series } },
// with published seasons and their episodes nested.
@Serializable
data class SeriesDetailResponse(val data: SeriesDetailData = SeriesDetailData())

@Serializable
data class SeriesDetailData(val series: Series? = null)

// GET /channels/:channelId/series/:seriesId/episodes/:episodeId
@Serializable
data class EpisodeDetailResponse(val data: EpisodeDetailData = EpisodeDetailData())

@Serializable
data class EpisodeDetailData(val episode: Episode? = null)

// GET /broadcast/now-playing/:channelId - what a native channel is airing.
@Serializable
data class NowPlayingResponse(
    @SerialName("now_playing") val nowPlaying: NowPlaying? = null
)

@Serializable
data class NowPlaying(
    @SerialName("video_url") val videoUrl: String = "",
    @SerialName("video_title") val videoTitle: String = "",
    // Seconds into the video the schedule is at right now.
    val position: Long = 0,
    val duration: Long = 0
)

@Serializable
data class TvSessionRequest(
    @SerialName("device_id") val deviceId: String,
    @SerialName("device_name") val deviceName: String
)

@Serializable
data class TvSessionUser(
    val id: String = "",
    val name: String? = null,
    @SerialName("display_name") val displayName: String? = null,
    val email: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null
)

@Serializable
data class TvSessionResponse(
    @SerialName("session_id") val sessionId: String = "",
    @SerialName("pairing_code") val pairingCode: String = "",
    @SerialName("qr_url") val qrUrl: String = "",
    @SerialName("expires_in") val expiresIn: Int = 300
)

@Serializable
data class TvSessionStatus(
    val status: String = "",
    val token: String? = null,
    val user: TvSessionUser? = null
)

@Serializable
data class ActivationRequest(
    val code: String,
    @SerialName("device_id") val deviceId: String,
    @SerialName("device_name") val deviceName: String,
    // "signin" (existing account, verified by password) or "register" (new
    // account) - see backend tv.controller.js resolveOwnerForSignIn /
    // resolveOwnerForRegister. Omitted/anything else defaults to register.
    val mode: String = "register",
    @SerialName("owner_name") val ownerName: String = "",
    @SerialName("owner_email") val ownerEmail: String,
    @SerialName("owner_phone") val ownerPhone: String = "",
    @SerialName("owner_password") val ownerPassword: String? = null,
    @SerialName("app_version") val appVersion: String? = null
)

@Serializable
data class ActivationOwner(
    val email: String? = null,
    val name: String? = null
)

@Serializable
data class ActivationResponse(
    val success: Boolean = false,
    val reactivated: Boolean = false,
    @SerialName("device_token") val deviceToken: String = "",
    // Real user-kind JWT for the linked account (sign-in or a freshly
    // registered account) - lets activation alone yield personalized
    // content immediately, same as QR pairing does.
    @SerialName("user_token") val userToken: String? = null,
    @SerialName("device_id") val deviceId: String = "",
    val owner: ActivationOwner? = null,
    @SerialName("config_version") val configVersion: Int? = null
)

@Serializable
data class ApiError(
    val error: String? = null,
    val message: String? = null
)

@Serializable
data class HeartbeatRequest(
    @SerialName("app_version") val appVersion: String? = null
)

@Serializable
data class HeartbeatResponse(
    val enabled: Boolean = true,
    @SerialName("disabled_reason") val disabledReason: String? = null,
    @SerialName("app_update") val appUpdate: AppUpdate? = null,
    @SerialName("unread_messages") val unreadMessages: Int = 0,
    @SerialName("config_version") val configVersion: Int? = null,
    @SerialName("server_time") val serverTime: String? = null
)

@Serializable
data class AppUpdate(
    @SerialName("latest_version_code") val latestVersionCode: Int = 1,
    @SerialName("latest_version_name") val latestVersionName: String? = null,
    @SerialName("apk_url") val apkUrl: String? = null
)

@Serializable
data class Message(
    val id: String = "",
    val type: String = "",
    val title: String = "",
    val body: String = "",
    val unread: Boolean = false,
    @SerialName("allow_reply") val allowReply: Boolean = true,
    @SerialName("created_at") val createdAt: String? = null
) {
    val read: Boolean get() = !unread
}

@Serializable
data class MessagesResponse(
    val messages: List<Message> = emptyList(),
    val data: List<Message> = emptyList()
)

@Serializable
data class MarkReadRequest(
    val ids: List<String> = emptyList()
)

@Serializable
data class MarkReadResponse(
    val success: Boolean = false
)

@Serializable
data class ReplyRequest(
    val body: String = ""
)

@Serializable
data class ReplyResponse(
    val success: Boolean = false
)

// ── TV-to-TV chat ────────────────────────────────────────────────

@Serializable
data class ChatPinResponse(
    val pin: String = ""
)

@Serializable
data class ChatConnectRequest(
    val pin: String
)

@Serializable
data class ChatRespondRequest(
    val accept: Boolean
)

@Serializable
data class ChatSendRequest(
    val body: String
)

@Serializable
data class ChatUserInfo(
    val id: String = "",
    val name: String = "",
    val avatar: String? = null
)

@Serializable
data class ChatConnection(
    val id: String = "",
    val status: String = "pending",
    @SerialName("requested_by_me") val requestedByMe: Boolean = false,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("accepted_at") val acceptedAt: String? = null,
    @SerialName("other_user") val otherUser: ChatUserInfo? = null,
    @SerialName("unread_count") val unreadCount: Int = 0
)

@Serializable
data class ChatConnectionsResponse(
    val connections: List<ChatConnection> = emptyList()
)

@Serializable
data class ChatConnectionEnvelope(
    val connection: ChatConnection? = null
)

@Serializable
data class ChatMessage(
    val id: String = "",
    @SerialName("connection_id") val connectionId: String = "",
    @SerialName("sender_id") val senderId: String = "",
    val body: String = "",
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class ChatMessagesResponse(
    val messages: List<ChatMessage> = emptyList()
)

@Serializable
data class ChatMessageEnvelope(
    val message: ChatMessage? = null
)

@Serializable
data class SuccessResponse(
    val success: Boolean = false
)

@Serializable
data class SubscribeRequest(
    @SerialName("channel_id") val channelId: String
)

// Same real endpoint (GET /subscriptions/channel/mine, user-JWT auth) the
// mobile app's ChannelSubscriptionService.getMine() calls - returns every
// membership record regardless of status, unlike the TV-device-token
// /distribution/tv/exclusive/access route which only ever returns active
// ones. Needed to tell "never had access" apart from "had it, now expired"
// for the Renew card.
@Serializable
data class ChannelSubscription(
    val id: String = "",
    @SerialName("channel_id") val channelId: String = "",
    @SerialName("channel_name") val channelName: String = "Unknown channel",
    val status: String = "",
    @SerialName("is_premium") val isPremium: Boolean = false,
    val amount: Double = 0.0,
    val currency: String? = null,
    @SerialName("interval_unit") val intervalUnit: String = "month",
    @SerialName("next_billing") val nextBilling: Long? = null
) {
    val isActive: Boolean get() = status == "active"
}

@Serializable
data class ChannelSubscriptionsResponse(
    val subscriptions: List<ChannelSubscription> = emptyList()
)

@Serializable
data class ChannelViewRequest(
    @SerialName("platform") val platform: String = "tv"
)

@Serializable
data class WatchPingRequest(
    @SerialName("seconds") val seconds: Int,
    @SerialName("platform") val platform: String = "tv"
)

@Serializable
/**
 * The "feed" is the viewer's following feed of waves — the backend has no
 * separate social-post entity, so these fields mirror a wave document.
 */
data class FeedPost(
    val id: String = "",
    val title: String = "",
    val description: String? = null,
    @SerialName("thumbnail_url") val thumbnailUrl: String? = null,
    @SerialName("video_url") val videoUrl: String? = null,
    @SerialName("created_at") val createdAt: Long = 0
)

@Serializable
data class MarqueeTopic(
    val id: String = "",
    val text: String = "",
    val priority: Int = 1,
    val active: Boolean = true
)

@Serializable
data class UserProfile(
    val id: String = "",
    val name: String = "",
    @SerialName("avatar_url") val avatar: String = "",
    @SerialName("subscription_plan") val tier: String = "",
    @SerialName("is_premium_creator") val isPremiumCreator: Boolean = false,
    @SerialName("paired_device_count") val pairedDeviceCount: Int = 0,
    val posts: List<FeedPost> = emptyList()
)

@Serializable
data class UserProfileResponse(
    val user: UserProfile = UserProfile()
)

@Serializable
data class ExclusiveAccess(
    @SerialName("channel_id") val channelId: String = "",
    @SerialName("channel_name") val channelName: String = "",
    @SerialName("expires_at") val expiresAt: String? = null,
    @SerialName("monthly_fee_ngn") val monthlyFeeNgn: Double? = null
)

@Serializable
data class ExclusiveAccessSummary(
    val accesses: List<ExclusiveAccess> = emptyList(),
    val total: Int = 0
)

@Serializable
data class ChannelLibraryResponse(
    val channels: List<Channel> = emptyList(),
    val data: List<Channel> = emptyList()
)

// ── Reading library (books/comics/magazines) - GET /library/feed ───
// Not to be confused with ChannelLibraryResponse above, which is a
// different, unrelated feature (a user's saved/followed TV channels).

@Serializable
data class LibraryFeedItem(
    val id: String = "",
    @SerialName("channelId") val channelId: String = "",
    val title: String = "",
    val subtitle: String? = null,
    val author: String? = null,
    @SerialName("contentType") val contentType: String = "",
    @SerialName("coverAssetUrl") val coverAssetUrl: String? = null,
    @SerialName("totalPages") val totalPages: Int? = null
)

@Serializable
data class LibraryFeedPage(
    val items: List<LibraryFeedItem> = emptyList()
)

@Serializable
data class LibraryFeedResponse(
    val success: Boolean = false,
    val data: LibraryFeedPage = LibraryFeedPage()
)

@Serializable
data class ContinueReadingRecord(
    @SerialName("currentSpreadIndex") val currentSpreadIndex: Int = 0,
    @SerialName("isCompleted") val isCompleted: Boolean = false,
    @SerialName("channelId") val channelId: String = "",
    @SerialName("itemId") val itemId: String = "",
    val item: LibraryFeedItem? = null
)

@Serializable
data class ContinueReadingResponse(
    val success: Boolean = false,
    val data: List<ContinueReadingRecord> = emptyList()
)

// Reader bookmarks - same records as the website reader
// (GET/POST/DELETE /distribution/tv/library/{channelId}/{itemId}/bookmarks).
@Serializable
data class LibraryBookmark(
    val id: String = "",
    @SerialName("spreadIndex") val spreadIndex: Int = 0,
    val page: Int? = null,
    val note: String? = null
)

@Serializable
data class LibraryBookmarkListResponse(val data: List<LibraryBookmark> = emptyList())

@Serializable
data class LibraryBookmarkResponse(val data: LibraryBookmark? = null)

@Serializable
data class CreateBookmarkRequest(
    @SerialName("spreadIndex") val spreadIndex: Int,
    val page: Int? = null
)

// ── Exclusive content, per channel - GET /distribution/tv/exclusive/* ──

@Serializable
data class ChannelMoviesPage(val movies: List<Movie> = emptyList())

@Serializable
data class ChannelMoviesResponse(val success: Boolean = false, val data: ChannelMoviesPage = ChannelMoviesPage())

@Serializable
data class ChannelSeriesPage(val series: List<Series> = emptyList())

@Serializable
data class ChannelSeriesResponse(val success: Boolean = false, val data: ChannelSeriesPage = ChannelSeriesPage())

// ChannelLibraryItemsResponse: reuses LibraryFeedResponse/LibraryFeedPage
// above - listItems and listPublicLibrary share the same {data:{items:[...]}} shape.

@Serializable
data class FeedResponse(
    val waves: List<FeedPost> = emptyList(),
    @SerialName("next_cursor") val nextCursor: String? = null
)

@Serializable
data class CatchUpCredit(
    val id: String = "",
    val name: String = "",
    @SerialName("profileUrl") val profileUrl: String? = null,
    val character: String? = null,
    val job: String? = null
)

@Serializable
data class CatchUpItem(
    val id: String = "",
    val type: String = "",
    val title: String = "",
    val overview: String = "",
    @SerialName("posterUrl") val posterUrl: String? = null,
    @SerialName("backdropUrl") val backdropUrl: String? = null,
    @SerialName("trailer_url") val trailerUrl: String? = null,
    val rating: Double = 0.0,
    @SerialName("release_date") val releaseDate: String? = null,
    val runtime: Int? = null,
    val certification: String? = null,
    val genres: List<String> = emptyList(),
    val cast: List<CatchUpCredit> = emptyList(),
    val directors: List<CatchUpCredit> = emptyList(),
    val recommendations: List<CatchUpItem> = emptyList()
)

@Serializable
data class CatchUpPerson(
    val id: String = "",
    val name: String = "",
    @SerialName("profileUrl") val profileUrl: String? = null,
    @SerialName("known_for") val knownFor: List<String> = emptyList()
)

@Serializable
data class CatchUpRail(
    val title: String = "",
    val items: List<CatchUpItem> = emptyList()
)

@Serializable
data class CatchUpHome(
    val hero: List<CatchUpItem> = emptyList(),
    @SerialName("episode_spotlight") val episodeSpotlight: CatchUpItem? = null,
    @SerialName("trending_people") val trendingPeople: List<CatchUpPerson> = emptyList(),
    val rails: List<CatchUpRail> = emptyList()
)

@Serializable
data class CatchUpHomeResponse(
    val data: CatchUpHome = CatchUpHome()
)

@Serializable
data class CatchUpDetailResponse(
    val data: CatchUpItem = CatchUpItem()
)

@Serializable
data class SearchResponse<T>(
    val data: List<T> = emptyList()
)
