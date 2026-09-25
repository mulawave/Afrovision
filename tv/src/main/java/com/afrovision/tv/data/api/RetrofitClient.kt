package com.afrovision.tv.data.api

import com.afrovision.tv.BASE_URL
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

object TokenHolder {
    var token: String = ""
    var deviceToken: String = ""
}

object RetrofitClient {
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    private val authInterceptor = Interceptor { chain ->
        val request = chain.request()
        val path = request.url.encodedPath
        val noAuth = path == "/home/content"
        // /distribution/tv/* (heartbeat, channels, messages, chat) requires
        // the "tv_device"-kind JWT specifically - sending the general/user
        // token there is rejected outright (401), since the backend checks
        // the token's `kind` claim. Everything else gets the general token,
        // falling back to the device token pre-QR-pairing so unpaired TVs
        // keep behaving exactly as before (anonymous/public content).
        val token = if (path.startsWith("/distribution/tv/")) {
            TokenHolder.deviceToken
        } else {
            TokenHolder.token.ifBlank { TokenHolder.deviceToken }
        }
        val newRequest = if (token.isNotBlank() && !noAuth) {
            request.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            request
        }
        chain.proceed(newRequest)
    }

    // OkHttp's 10s defaults are too tight here: the backend already takes
    // 4-6s for /channels and /movies on a good connection, and a low-end TV
    // on a slower network regularly went past 10s. A timed-out /channels
    // left the channel surfer, channel up/down and number dialing empty.
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(45, java.util.concurrent.TimeUnit.SECONDS)
        .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .addInterceptor(authInterceptor)
        .addInterceptor(
            HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }
        )
        .build()

    val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    val api: ApiService = retrofit.create(ApiService::class.java)
}
