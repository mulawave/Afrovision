package com.afrovision.afrovision.ads

import android.app.Activity
import android.content.Context
import android.content.pm.ApplicationInfo
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.bytedance.sdk.openadsdk.api.init.PAGConfig
import com.bytedance.sdk.openadsdk.api.init.PAGSdk
import com.bytedance.sdk.openadsdk.api.interstitial.PAGInterstitialAd
import com.bytedance.sdk.openadsdk.api.interstitial.PAGInterstitialAdInteractionListener
import com.bytedance.sdk.openadsdk.api.interstitial.PAGInterstitialAdLoadListener
import com.bytedance.sdk.openadsdk.api.interstitial.PAGInterstitialRequest
import com.bytedance.sdk.openadsdk.api.open.PAGAppOpenAd
import com.bytedance.sdk.openadsdk.api.open.PAGAppOpenAdInteractionListener
import com.bytedance.sdk.openadsdk.api.open.PAGAppOpenAdLoadListener
import com.bytedance.sdk.openadsdk.api.open.PAGAppOpenRequest

/** Pangle placement ids (ADtv Go, Android). */
object PangleIds {
    const val APP_ID = "8876269"

    // Each entry lists every unit for that slot: the "_adtv" (Global CPM) unit
    // first, then the In-App Bidding twin. Requests alternate between them and
    // a failed attempt falls through to the other, so a throttled or paused
    // unit never blanks the placement.
    val SPOTLIGHT_BANNER = listOf("983651145", "983497222")
    val BIG_BANNER = listOf("983651187")
    val INTERSTITIAL = listOf("983651152")
    val APP_OPEN = listOf("890184905", "890175370")
    val NATIVE_ADVANCED = listOf("983651153", "983497225")
    val NATIVE_WAVES = listOf("983651171", "983497249")

    private val counters = HashMap<String, Int>()

    /** Round-robin start index so consecutive requests alternate units. */
    @Synchronized
    fun nextStart(kind: String): Int {
        val n = counters.getOrDefault(kind, 0)
        counters[kind] = n + 1
        return n
    }

    fun pick(ids: List<String>, start: Int, attempt: Int): String =
        ids[(start + attempt) % ids.size]
}

/**
 * Owns SDK initialisation. Every ad surface gates on [whenReady] so nothing
 * ever calls `loadAd` before `PAGSdk.init` has reported success.
 */
object PangleAdsManager {
    const val TAG = "PangleAds"
    val main = Handler(Looper.getMainLooper())

    @Volatile
    var ready = false
        private set
    private var initializing = false
    private var initAttempts = 0
    private val waiters = mutableListOf<() -> Unit>()

    fun init(context: Context) {
        if (ready || initializing) return
        initializing = true
        val app = context.applicationContext
        val debuggable = (app.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        val config = PAGConfig.Builder()
            .appId(PangleIds.APP_ID)
            .debugLog(debuggable)
            .supportMultiProcess(false)
            .build()
        PAGSdk.init(app, config, object : PAGSdk.PAGInitCallback {
            override fun success() {
                Log.i(TAG, "Pangle init success (sdk ${PAGSdk.getSDKVersion()})")
                main.post {
                    ready = true
                    initializing = false
                    val pending = waiters.toList()
                    waiters.clear()
                    pending.forEach { it() }
                    PangleFullscreen.preloadAll()
                }
            }

            override fun fail(code: Int, message: String?) {
                Log.w(TAG, "Pangle init failed: $code $message")
                main.post {
                    initializing = false
                    initAttempts++
                    if (initAttempts < 4) {
                        main.postDelayed({ init(app) }, 3000L * initAttempts)
                    }
                }
            }
        })
    }

    /** Pangle may call back on a worker thread; views and channels need main. */
    fun ui(block: () -> Unit) {
        main.post(block)
    }

    /** Runs [block] on the main thread once the SDK is initialised. */
    fun whenReady(block: () -> Unit) {
        main.post {
            if (ready) block() else waiters.add(block)
        }
    }

    fun cancelWaiter(block: () -> Unit) {
        main.post { waiters.remove(block) }
    }
}

/** Interstitial + app-open: preloaded, retried once, shown only on a live activity. */
object PangleFullscreen {
    private const val TAG = "PangleAds"
    private const val RETRY_DELAY_MS = 800L
    private var interstitial: PAGInterstitialAd? = null
    private var interstitialLoading = false
    private var appOpen: PAGAppOpenAd? = null
    private var appOpenLoading = false
    private var appOpenSeq = 0
    private var interstitialSeq = 0

    @Volatile
    private var showing = false

    fun preloadAll() {
        preloadInterstitial(0)
        preloadAppOpen(0)
    }

    private fun preloadInterstitial(attempt: Int) {
        if (interstitial != null || interstitialLoading) return
        PangleAdsManager.whenReady {
            interstitialLoading = true
            PAGInterstitialAd.loadAd(
                PangleIds.pick(PangleIds.INTERSTITIAL, interstitialSeq++, 0),
                PAGInterstitialRequest(),
                object : PAGInterstitialAdLoadListener {
                    override fun onError(code: Int, message: String?) = PangleAdsManager.ui {
                        Log.w(TAG, "interstitial load failed: $code $message")
                        interstitialLoading = false
                        if (attempt < 1) {
                            PangleAdsManager.main.postDelayed(
                                { preloadInterstitial(attempt + 1) },
                                RETRY_DELAY_MS,
                            )
                        }
                    }

                    override fun onAdLoaded(ad: PAGInterstitialAd) = PangleAdsManager.ui {
                        interstitialLoading = false
                        Log.i(TAG, "interstitial loaded")
                        interstitial = ad
                    }
                },
            )
        }
    }

    private fun preloadAppOpen(attempt: Int) {
        if (appOpen != null || appOpenLoading) return
        PangleAdsManager.whenReady {
            appOpenLoading = true
            val request = PAGAppOpenRequest().apply { timeout = 3000 }
            PAGAppOpenAd.loadAd(
                PangleIds.pick(PangleIds.APP_OPEN, appOpenSeq++, 0),
                request,
                object : PAGAppOpenAdLoadListener {
                    override fun onError(code: Int, message: String?) = PangleAdsManager.ui {
                        Log.w(TAG, "app-open load failed: $code $message")
                        appOpenLoading = false
                        if (attempt < 1) {
                            PangleAdsManager.main.postDelayed(
                                { preloadAppOpen(attempt + 1) },
                                RETRY_DELAY_MS,
                            )
                        }
                    }

                    override fun onAdLoaded(ad: PAGAppOpenAd) = PangleAdsManager.ui {
                        appOpenLoading = false
                        Log.i(TAG, "app-open loaded")
                        appOpen = ad
                    }
                },
            )
        }
    }

    private fun activityUsable(activity: Activity?): Boolean =
        activity != null && !activity.isFinishing && !activity.isDestroyed

    /** Returns true when an ad was actually handed to the SDK to show. */
    fun showInterstitial(activity: Activity?): Boolean {
        val ad = interstitial
        if (ad == null) {
            preloadInterstitial(0)
            return false
        }
        if (showing || !activityUsable(activity)) return false
        interstitial = null
        showing = true
        ad.setAdInteractionListener(object : PAGInterstitialAdInteractionListener {
            override fun onAdShowed() {}
            override fun onAdClicked() {}
            override fun onAdDismissed() {
                showing = false
                preloadInterstitial(0)
            }
        })
        return try {
            ad.show(activity!!)
            true
        } catch (e: Exception) {
            Log.w(TAG, "interstitial show failed", e)
            showing = false
            preloadInterstitial(0)
            false
        }
    }

    fun showAppOpen(activity: Activity?): Boolean {
        val ad = appOpen
        if (ad == null) {
            preloadAppOpen(0)
            return false
        }
        if (showing || !activityUsable(activity)) return false
        appOpen = null
        showing = true
        ad.setAdInteractionListener(object : PAGAppOpenAdInteractionListener {
            override fun onAdShowed() {}
            override fun onAdClicked() {}
            override fun onAdDismissed() {
                showing = false
                preloadAppOpen(0)
            }
        })
        return try {
            ad.show(activity!!)
            true
        } catch (e: Exception) {
            Log.w(TAG, "app-open show failed", e)
            showing = false
            preloadAppOpen(0)
            false
        }
    }
}
