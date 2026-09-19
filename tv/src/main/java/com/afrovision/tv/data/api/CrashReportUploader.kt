package com.afrovision.tv.data.api

import com.afrovision.tv.BASE_URL
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Fire-and-forget upload of a locally-persisted crash report (see
 * TvApplication.persistCrashReport) to a public, unauthenticated backend
 * route - deliberately not routed through the app's normal authenticated
 * ApiService/Retrofit stack, since a crash can happen before that's ever
 * been set up, and this needs to work regardless of auth state. This is the
 * only way to see what actually happened on a real TV crash, since there is
 * no way to attach a debugger or pull logcat off a viewer's television.
 */
object CrashReportUploader {
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    fun upload(report: String) {
        val body = JSONObject().put("report", report).toString()
            .toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("$BASE_URL/distribution/tv/crash-report")
            .post(body)
            .build()
        client.newCall(request).execute().close()
    }
}
