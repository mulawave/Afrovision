package com.afrovision.tv

import android.app.Application
import android.os.Build
import android.os.Looper
import android.util.Log
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.afrovision.tv.net.NetworkReconnector
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

class TvApplication : Application(), ImageLoaderFactory {

    val networkReconnector by lazy { NetworkReconnector(this) }

    override fun onCreate() {
        super.onCreate()
        installBringIntoViewCrashGuard()
        uploadPendingCrashReportIfAny()
        networkReconnector.start()
    }

    /**
     * There is no way to plug a debugger or pull logcat off this app's
     * actual deployment target (a viewer's TV, not a dev device), so a real
     * crash otherwise leaves zero trace anywhere - Cloud Run's own logs only
     * ever see HTTP traffic, never anything from inside the app process.
     * Every OTHER (non-benign-focus-race) uncaught exception now gets
     * written to a local file synchronously before the process dies - the
     * only work safe to do at that point, since the message pump is
     * already gone. The NEXT app launch reads and uploads it, then deletes
     * it, so a crash becomes diagnosable one restart later instead of
     * invisible forever.
     */
    private fun crashReportFile() = File(filesDir, "last_crash.txt")

    private fun persistCrashReport(thread: Thread, throwable: Throwable) {
        try {
            val writer = StringWriter()
            throwable.printStackTrace(PrintWriter(writer))
            val packageInfo = packageManager.getPackageInfo(packageName, 0)
            val report = buildString {
                appendLine("thread=${thread.name}")
                appendLine("versionCode=${packageInfo.longVersionCode}")
                appendLine("versionName=${packageInfo.versionName}")
                appendLine("device=${Build.MANUFACTURER} ${Build.MODEL} (Android ${Build.VERSION.RELEASE})")
                appendLine("timestamp=${System.currentTimeMillis()}")
                appendLine("---")
                append(writer.toString())
            }
            crashReportFile().writeText(report)
        } catch (_: Throwable) {
            // Best-effort only - never let crash reporting itself throw
            // during an uncaught-exception handler.
        }
    }

    private fun uploadPendingCrashReportIfAny() {
        val file = crashReportFile()
        if (!file.exists()) return
        Thread {
            try {
                val report = file.readText()
                com.afrovision.tv.data.api.CrashReportUploader.upload(report)
            } catch (e: Exception) {
                Log.w(TV_APP_TAG, "crash report upload failed", e)
            } finally {
                file.delete()
            }
        }.start()
    }

    /**
     * Compose Foundation's scrollable containers (verticalScroll, LazyRow/
     * LazyColumn) auto-scroll a newly-focused descendant into view whenever ANY focus
     * change happens inside them - including the system's own automatic
     * initial-focus grab when a window first attaches, which this app does
     * not call directly. When that races the first layout/placement pass it
     * throws IllegalStateException("Expected BringIntoViewRequester to not
     * be used before parents are placed.") from a framework-internal
     * coroutine that no app-level try/catch can reach, crashing the whole
     * app on launch. Explicit requestFocus() call sites in this app are
     * already guarded to wait for placement (see
     * com.afrovision.tv.ui.focus.autoRequestFocus and the equivalent inline
     * pattern in NavRail/ActivationScreen/etc.) but the automatic grab is
     * framework-driven and can't be gated the same way. Swallow only this
     * specific, known-benign race instead of crashing; anything else still
     * crashes normally.
     */
    private fun installBringIntoViewCrashGuard() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        val mainThread = Looper.getMainLooper().thread
        Thread.setDefaultUncaughtExceptionHandler thread@{ thread, throwable ->
            val isBringIntoViewRace = throwable is IllegalStateException &&
                throwable.message?.contains("BringIntoViewRequester") == true
            if (!isBringIntoViewRace || thread != mainThread) {
                persistCrashReport(thread, throwable)
                previous?.uncaughtException(thread, throwable)
                return@thread
            }
            // A plain log-and-swallow here does not actually save the app:
            // by the time this handler runs, Looper.loop() has already
            // unwound off the main thread's call stack, so the message pump
            // has stopped and the process is effectively dead even if this
            // handler returns normally. Re-entering Looper.loop() from here
            // resumes pumping messages on the same (still-alive) main
            // thread, which is the standard way to survive this specific
            // kind of framework-internal, benign focus race without the
            // user seeing a crash.
            while (true) {
                try {
                    Log.w(TV_APP_TAG, "Recovering from benign BringIntoViewRequester focus race", throwable)
                    Looper.loop()
                    return@thread
                } catch (again: Throwable) {
                    val stillBenign = again is IllegalStateException &&
                        again.message?.contains("BringIntoViewRequester") == true
                    if (!stillBenign) {
                        previous?.uncaughtException(thread, again)
                        return@thread
                    }
                }
            }
        }
    }

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .crossfade(true)
            // Coil's built-in client uses 10s timeouts. On a slow link, a
            // screenful of posters/covers downloading at once regularly ran
            // past that and stayed blank with no retry.
            .okHttpClient {
                okhttp3.OkHttpClient.Builder()
                    .connectTimeout(20, java.util.concurrent.TimeUnit.SECONDS)
                    .readTimeout(45, java.util.concurrent.TimeUnit.SECONDS)
                    .build()
            }
            // filesDir, not cacheDir: Android empties cacheDir whenever
            // storage runs low, which on small-storage TVs meant every
            // logo, poster and cover was downloaded again on each launch.
            // Fixed budget so it can't grow unbounded on a small disk.
            .diskCache(
                DiskCache.Builder()
                    .directory(File(filesDir, "image_cache"))
                    .maxSizeBytes(IMAGE_DISK_CACHE_BYTES)
                    .build()
            )
            .memoryCache { MemoryCache.Builder(this).maxSizePercent(0.25).build() }
            // Half the memory per opaque image; keeps low-RAM TVs from
            // dropping decodes when many cards are on screen.
            .allowRgb565(true)
            .build()
    }
}

private const val IMAGE_DISK_CACHE_BYTES = 150L * 1024 * 1024
