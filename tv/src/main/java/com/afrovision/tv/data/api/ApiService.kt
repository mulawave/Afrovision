package com.afrovision.tv.data.api

import com.afrovision.tv.data.api.model.ActivationRequest
import com.afrovision.tv.data.api.model.ActivationResponse
import com.afrovision.tv.data.api.model.ChannelDetailResponse
import com.afrovision.tv.data.api.model.ExclusiveAccessSummary
import com.afrovision.tv.data.api.model.ChannelLibraryResponse
import com.afrovision.tv.data.api.model.CatchUpDetailResponse
import com.afrovision.tv.data.api.model.CatchUpHomeResponse
import com.afrovision.tv.data.api.model.ChatConnectRequest
import com.afrovision.tv.data.api.model.ChatConnectionEnvelope
import com.afrovision.tv.data.api.model.ChatConnectionsResponse
import com.afrovision.tv.data.api.model.ChatMessageEnvelope
import com.afrovision.tv.data.api.model.ChatMessagesResponse
import com.afrovision.tv.data.api.model.ChatPinResponse
import com.afrovision.tv.data.api.model.ChatRespondRequest
import com.afrovision.tv.data.api.model.ChatSendRequest
import com.afrovision.tv.data.api.model.SuccessResponse
import com.afrovision.tv.data.api.model.ChannelListResponse
import com.afrovision.tv.data.api.model.FeedResponse
import com.afrovision.tv.data.api.model.HomepageContentResponse
import com.afrovision.tv.data.api.model.LibraryFeedResponse
import com.afrovision.tv.data.api.model.LibraryItemDetailResponse
import com.afrovision.tv.data.api.model.LibraryReaderManifestInfoResponse
import com.afrovision.tv.data.api.model.LibraryProgress
import com.afrovision.tv.data.api.model.LibraryProgressResponse
import com.afrovision.tv.data.api.model.ContinueReadingResponse
import com.afrovision.tv.data.api.model.ChannelMoviesResponse
import com.afrovision.tv.data.api.model.ChannelSeriesResponse
import com.afrovision.tv.data.api.model.HeartbeatRequest
import com.afrovision.tv.data.api.model.HeartbeatResponse
import com.afrovision.tv.data.api.model.MarkReadRequest
import com.afrovision.tv.data.api.model.MarkReadResponse
import com.afrovision.tv.data.api.model.MessagesResponse
import com.afrovision.tv.data.api.model.MovieListResponse
import com.afrovision.tv.data.api.model.ReplyRequest
import com.afrovision.tv.data.api.model.ReplyResponse
import com.afrovision.tv.data.api.model.SeriesListResponse
import com.afrovision.tv.data.api.model.SubscribeRequest
import com.afrovision.tv.data.api.model.TvSessionRequest
import com.afrovision.tv.data.api.model.TvSessionResponse
import com.afrovision.tv.data.api.model.TvSessionStatus
import com.afrovision.tv.data.api.model.WatchProgressResponse
import com.afrovision.tv.data.api.model.WaveListResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.QueryMap

interface ApiService {

    @GET("/channels")
    suspend fun getChannels(@QueryMap query: Map<String, String> = emptyMap()): ChannelListResponse

    @GET("/movies")
    suspend fun getMovies(@QueryMap query: Map<String, String> = emptyMap()): MovieListResponse

    @GET("/series")
    suspend fun getSeries(@QueryMap query: Map<String, String> = emptyMap()): SeriesListResponse

    @GET("/wave/feed")
    suspend fun getWaves(@QueryMap query: Map<String, String> = emptyMap()): WaveListResponse

    @GET("/wave/{waveId}/pulses/moments")
    suspend fun getWavePulseMoments(@Path("waveId") waveId: String): com.afrovision.tv.data.api.model.WavePulseMomentsResponse

    @GET("/wave/me/bookmarks")
    suspend fun getWaveBookmarks(): List<com.afrovision.tv.data.api.model.Wave>

    @POST("/wave/{waveId}/pulse")
    suspend fun addWavePulse(@Path("waveId") waveId: String, @Body body: Map<String, Int>)

    @POST("/wave/{waveId}/bookmark")
    suspend fun toggleWaveBookmark(@Path("waveId") waveId: String): com.afrovision.tv.data.api.model.WaveBookmarkStatus

    @GET("/watch-progress/me")
    suspend fun getWatchProgress(): WatchProgressResponse

    @GET("/channel-library/mine")
    suspend fun getChannelLibrary(): ChannelLibraryResponse

    @GET("/library/feed")
    suspend fun getLibraryFeed(@QueryMap query: Map<String, String> = emptyMap()): LibraryFeedResponse

    @GET("/distribution/tv/library/continue-reading")
    suspend fun getContinueReading(@Query("limit") limit: Int = 12): ContinueReadingResponse

    @GET("/distribution/tv/library/{channelId}/{itemId}")
    suspend fun getLibraryItemDetail(
        @Path("channelId") channelId: String,
        @Path("itemId") itemId: String
    ): LibraryItemDetailResponse

    @GET("/distribution/tv/library/{channelId}/{itemId}/reader-manifest")
    suspend fun getLibraryReaderManifestInfo(
        @Path("channelId") channelId: String,
        @Path("itemId") itemId: String
    ): LibraryReaderManifestInfoResponse

    @GET("/distribution/tv/library/{channelId}/{itemId}/progress")
    suspend fun getLibraryProgress(
        @Path("channelId") channelId: String,
        @Path("itemId") itemId: String
    ): LibraryProgressResponse

    @PUT("/distribution/tv/library/{channelId}/{itemId}/progress")
    suspend fun putLibraryProgress(
        @Path("channelId") channelId: String,
        @Path("itemId") itemId: String,
        @Body progress: LibraryProgress
    ): LibraryProgressResponse

    @GET("/distribution/tv/exclusive/{channelId}/movies")
    suspend fun getExclusiveChannelMovies(@Path("channelId") channelId: String): ChannelMoviesResponse

    @GET("/distribution/tv/exclusive/{channelId}/series")
    suspend fun getExclusiveChannelSeries(@Path("channelId") channelId: String): ChannelSeriesResponse

    @GET("/distribution/tv/exclusive/{channelId}/library")
    suspend fun getExclusiveChannelLibrary(@Path("channelId") channelId: String): LibraryFeedResponse

    @GET("/home/content")
    suspend fun getHomepageContent(): HomepageContentResponse

    // Same public endpoint the mobile app and website use for their ticker
    // (see HomeService.getMarqueeTopics in the Flutter app) - returns every
    // topic regardless of `active`, so the client filters, exactly like
    // mobile does.
    @GET("/home/marquee")
    suspend fun getMarqueeTopics(): List<com.afrovision.tv.data.api.model.MarqueeTopic>

    @GET("/feed")
    suspend fun getFeed(): FeedResponse

    @GET("/catchup/home")
    suspend fun getCatchUpHome(): CatchUpHomeResponse

    @GET("/catchup/detail")
    suspend fun getCatchUpDetail(@Query("type") type: String, @Query("id") id: String): CatchUpDetailResponse

    @GET("/users/me")
    suspend fun getProfile(): com.afrovision.tv.data.api.model.UserProfileResponse

    @POST("/auth/tv/session")
    suspend fun createTvSession(@Body request: TvSessionRequest): TvSessionResponse

    @GET("/auth/tv/session/{id}/status")
    suspend fun getSessionStatus(@Path("id") sessionId: String): TvSessionStatus

    @POST("/distribution/tv/activate")
    suspend fun activateTv(@Body request: ActivationRequest): ActivationResponse

    @POST("/distribution/tv/heartbeat")
    suspend fun heartbeat(@Body request: HeartbeatRequest): HeartbeatResponse

    @GET("/distribution/tv/channels")
    suspend fun getTvChannels(): ChannelListResponse

    @GET("/distribution/tv/exclusive/access")
    suspend fun getExclusiveAccessSummary(): ExclusiveAccessSummary

    // Real user-JWT endpoint (not device-token) - only works once the TV has
    // a real signed-in/registered user token, but unlike the device-token
    // summary above, it returns EVERY membership regardless of status, which
    // is the only way to tell "expired, needs renewal" apart from "never
    // subscribed" for the Renew card.
    @GET("/subscriptions/channel/mine")
    suspend fun getChannelSubscriptions(): com.afrovision.tv.data.api.model.ChannelSubscriptionsResponse

    @GET("/distribution/tv/channel/{number}")
    suspend fun getChannelByNumber(@Path("number") number: String): ChannelDetailResponse

    @GET("/distribution/tv/messages")
    suspend fun getMessages(): MessagesResponse

    @POST("/distribution/tv/messages/mark-read")
    suspend fun markMessagesRead(@Body request: MarkReadRequest): MarkReadResponse

    @POST("/distribution/tv/messages/{id}/reply")
    suspend fun replyToMessage(
        @Path("id") messageId: String,
        @Body request: ReplyRequest
    ): ReplyResponse

    @GET("/distribution/tv/chat/pin")
    suspend fun getChatPin(): ChatPinResponse

    @POST("/distribution/tv/chat/pin/regenerate")
    suspend fun regenerateChatPin(): ChatPinResponse

    @POST("/distribution/tv/chat/connections")
    suspend fun requestChatConnection(@Body request: ChatConnectRequest): ChatConnectionEnvelope

    @GET("/distribution/tv/chat/connections")
    suspend fun listChatConnections(): ChatConnectionsResponse

    @POST("/distribution/tv/chat/connections/{id}/respond")
    suspend fun respondToChatConnection(
        @Path("id") connectionId: String,
        @Body request: ChatRespondRequest
    ): ChatConnectionEnvelope

    @GET("/distribution/tv/chat/connections/{connectionId}/messages")
    suspend fun listChatMessages(@Path("connectionId") connectionId: String): ChatMessagesResponse

    @POST("/distribution/tv/chat/connections/{connectionId}/messages")
    suspend fun sendChatMessage(
        @Path("connectionId") connectionId: String,
        @Body request: ChatSendRequest
    ): ChatMessageEnvelope

    @POST("/distribution/tv/chat/connections/{connectionId}/read")
    suspend fun markChatConnectionRead(@Path("connectionId") connectionId: String): SuccessResponse

    @POST("/watch-progress/{mediaType}/{mediaId}")
    suspend fun updateWatchProgress(
        @Path("mediaType") mediaType: String,
        @Path("mediaId") mediaId: String,
        @Body position: Map<String, Long>
    )

    @POST("/wave/{id}/view")
    suspend fun trackWaveView(@Path("id") waveId: String)

    @POST("/subscriptions/channel/subscribe")
    suspend fun subscribeFree(@Body request: SubscribeRequest)
}
