package com.afrovision.afrovision.ads

import android.content.Context
import android.util.Log
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import com.bytedance.sdk.openadsdk.api.banner.PAGBannerAd
import com.bytedance.sdk.openadsdk.api.banner.PAGBannerAdInteractionListener
import com.bytedance.sdk.openadsdk.api.banner.PAGBannerAdLoadListener
import com.bytedance.sdk.openadsdk.api.banner.PAGBannerRequest
import com.bytedance.sdk.openadsdk.api.banner.PAGBannerSize
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.StandardMessageCodec
import io.flutter.plugin.platform.PlatformView
import io.flutter.plugin.platform.PlatformViewFactory

class PangleBannerFactory(private val messenger: BinaryMessenger) :
    PlatformViewFactory(StandardMessageCodec.INSTANCE) {
    override fun create(context: Context, viewId: Int, args: Any?): PlatformView {
        @Suppress("UNCHECKED_CAST")
        val params = args as? Map<String, Any?> ?: emptyMap()
        val big = (params["size"] as? String) == "big"
        return PangleBannerView(context, viewId, messenger, big)
    }

    companion object {
        const val VIEW_TYPE = "com.afrovision.afrovision/pangle_banner"
    }
}

/**
 * Banner surface. Gates on SDK readiness, then loads with up to 3 attempts
 * (initial, +2s, +4s). Each attempt is a plain sequential step — no competing
 * effects — and everything is cancelled on dispose so a late callback can
 * never touch a dead view.
 */
class PangleBannerView(
    context: Context,
    viewId: Int,
    messenger: BinaryMessenger,
    private val big: Boolean,
) : PlatformView {
    private val container = FrameLayout(context)
    private val channel = MethodChannel(messenger, "com.afrovision.afrovision/pangle_view_$viewId")
    private val main = PangleAdsManager.main
    private var banner: PAGBannerAd? = null
    private var disposed = false
    private var pendingRetry: Runnable? = null
    private var state = "loading"
    private val ids = if (big) PangleIds.BIG_BANNER else PangleIds.SPOTLIGHT_BANNER
    private val startOffset = PangleIds.nextStart(if (big) "big" else "spotlight")
    private val size = if (big) PAGBannerSize.BANNER_W_300_H_250 else PAGBannerSize.BANNER_W_320_H_50
    private val retryDelaysMs = longArrayOf(2000L, 4000L)

    private val start: () -> Unit = { load(0) }

    init {
        channel.setMethodCallHandler { call, result ->
            if (call.method == "state") result.success(state) else result.notImplemented()
        }
        PangleAdsManager.whenReady(start)
    }

    private fun succeed() {
        state = "loaded"
        channel.invokeMethod("loaded", null)
    }

    private fun fail() {
        state = "failed"
        channel.invokeMethod("failed", null)
    }

    private fun load(attempt: Int) {
        if (disposed) return
        val placementId = PangleIds.pick(ids, startOffset, attempt)
        PAGBannerAd.loadAd(placementId, PAGBannerRequest(size), object : PAGBannerAdLoadListener {
            override fun onError(code: Int, message: String?) {
                main.post { handleError(attempt, code, message) }
            }

            private fun handleError(attempt: Int, code: Int, message: String?) {
                Log.w(PangleAdsManager.TAG, "banner($placementId) load failed [$attempt]: $code $message")
                if (disposed) return
                if (attempt < retryDelaysMs.size) {
                    val retry = Runnable { load(attempt + 1) }
                    pendingRetry = retry
                    main.postDelayed(retry, retryDelaysMs[attempt])
                } else {
                    fail()
                }
            }

            override fun onAdLoaded(ad: PAGBannerAd) {
                main.post { handleLoaded(ad) }
            }

            private fun handleLoaded(ad: PAGBannerAd) {
                if (disposed) {
                    ad.destroy()
                    return
                }
                Log.i(PangleAdsManager.TAG, "banner($placementId) loaded")
                banner = ad
                ad.setAdInteractionListener(object : PAGBannerAdInteractionListener {
                    override fun onAdShowed() {}
                    override fun onAdClicked() {}
                    override fun onAdDismissed() {}
                })
                val view: View = ad.bannerView ?: run {
                    fail()
                    return
                }
                container.removeAllViews()
                container.addView(
                    view,
                    FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        Gravity.CENTER,
                    ),
                )
                succeed()
            }
        })
    }

    override fun getView(): View = container

    override fun dispose() {
        disposed = true
        channel.setMethodCallHandler(null)
        PangleAdsManager.cancelWaiter(start)
        pendingRetry?.let { main.removeCallbacks(it) }
        pendingRetry = null
        try {
            banner?.destroy()
        } catch (_: Exception) {
        }
        banner = null
        container.removeAllViews()
    }
}
