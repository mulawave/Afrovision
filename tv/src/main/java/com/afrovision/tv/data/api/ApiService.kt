package com.afrovision.tv.data.api

import com.afrovision.tv.data.api.model.ActivationRequest
import com.afrovision.tv.data.api.model.ActivationResponse
import com.afrovision.tv.data.api.model.ChannelDetailResponse
import com.afrovision.tv.data.api.model.ChannelLibraryResponse
import com.afrovision.tv.data.api.model.CatchUpDetailResponse
import com.afrovision.tv.data.api.model.CatchUpHomeResponse
import com.afrovision.tv.data.api.model.ChannelListResponse
import com.afrovision.tv.data.api.model.FeedResponse
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
import com.afrovision.tv.data.api.model.UserProfile
import com.afrovision.tv.data.api.model.WatchProgressResponse
import com.afrovision.tv.data.api.model.WaveListResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
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

    @GET("/wave")
    suspend fun getWaves(@QueryMap query: Map<String, String> = emptyMap()): WaveListResponse

    @GET("/watch-progress/me")
    suspend fun getWatchProgress(): WatchProgressResponse

    @GET("/channel-library/mine")
    suspend fun getChannelLibrary(): ChannelLibraryResponse

    @GET("/feed")
    suspend fun getFeed(): FeedResponse

    @GET("/catchup/home")
    suspend fun getCatchUpHome(): CatchUpHomeResponse

    @GET("/catchup/detail")
    suspend fun getCatchUpDetail(@Query("type") type: String, @Query("id") id: String): CatchUpDetailResponse

    @GET("/profile/me")
    suspend fun getProfile(): UserProfile

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
