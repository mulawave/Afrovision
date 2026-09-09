package com.afrovision.tv.data.api.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Channel(
    val id: String = "",
    val name: String = "",
    val description: String? = null,
    @SerialName("logo_url") val posterUrl: String? = null,
    @SerialName("channel_number") val channelNumber: Int? = null,
    @SerialName("is_live") val isLive: Boolean = false,
    @SerialName("is_exclusive") val isExclusive: Boolean = false,
    @SerialName("external_url") val externalUrl: String? = null,
    @SerialName("stream_url") val streamUrl: String? = null
)

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

@Serializable
data class Movie(
    val id: String = "",
    val title: String = "",
    val description: String? = null,
    @SerialName("poster_url") val posterUrl: String? = null,
    @SerialName("stream_url") val streamUrl: String? = null,
    @SerialName("external_url") val externalUrl: String? = null,
    val duration: Int? = null
)

@Serializable
data class MovieListResponse(
    val movies: List<Movie> = emptyList(),
    val data: List<Movie> = emptyList()
)

@Serializable
data class Series(
    val id: String = "",
    val title: String = "",
    val description: String? = null,
    @SerialName("poster_url") val posterUrl: String? = null,
    val seasons: List<Season> = emptyList()
)

@Serializable
data class Season(
    val id: String = "",
    val number: Int = 0,
    val episodes: List<Episode> = emptyList()
)

@Serializable
data class Episode(
    val id: String = "",
    val title: String = "",
    val description: String? = null,
    val number: Int = 0,
    @SerialName("stream_url") val streamUrl: String? = null,
    @SerialName("external_url") val externalUrl: String? = null,
    val duration: Int? = null
)

@Serializable
data class SeriesListResponse(
    val series: List<Series> = emptyList(),
    val data: List<Series> = emptyList()
)

@Serializable
data class Wave(
    val id: String = "",
    val title: String = "",
    val description: String? = null,
    @SerialName("thumbnail_url") val thumbnailUrl: String? = null,
    @SerialName("stream_url") val streamUrl: String? = null,
    @SerialName("external_url") val externalUrl: String? = null,
    @SerialName("creator_id") val creatorId: String? = null,
    @SerialName("creator_name") val creatorName: String? = null
)

@Serializable
data class WaveListResponse(
    val waves: List<Wave> = emptyList(),
    val data: List<Wave> = emptyList()
)

@Serializable
data class WatchProgress(
    val id: String = "",
    @SerialName("media_id") val mediaId: String = "",
    @SerialName("media_type") val mediaType: String = "",
    val position: Long = 0,
    val duration: Long = 0,
    @SerialName("last_updated") val lastUpdated: String? = null
)

@Serializable
data class WatchProgressResponse(
    val items: List<WatchProgress> = emptyList(),
    val data: List<WatchProgress> = emptyList()
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
    @SerialName("owner_name") val ownerName: String,
    @SerialName("owner_email") val ownerEmail: String,
    @SerialName("owner_phone") val ownerPhone: String,
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
    val read: Boolean = false,
    @SerialName("created_at") val createdAt: String? = null
)

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

@Serializable
data class SubscribeRequest(
    @SerialName("channel_id") val channelId: String
)

@Serializable
data class FeedPost(
    val id: String = "",
    @SerialName("author_name") val authorName: String = "",
    @SerialName("author_avatar") val authorAvatar: String? = null,
    val time: String = "",
    val body: String = "",
    @SerialName("media_url") val mediaUrl: String? = null
)

@Serializable
data class UserProfile(
    val id: String = "",
    val name: String = "",
    val avatar: String = "",
    val tier: String = "",
    @SerialName("paired_device_count") val pairedDeviceCount: Int = 0,
    val posts: List<FeedPost> = emptyList()
)

@Serializable
data class ChannelLibraryResponse(
    val channels: List<Channel> = emptyList(),
    val data: List<Channel> = emptyList()
)

@Serializable
data class FeedResponse(
    val posts: List<FeedPost> = emptyList(),
    val data: List<FeedPost> = emptyList()
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
