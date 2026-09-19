package com.afrovision.afrovision.ads

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.bytedance.sdk.openadsdk.api.nativeAd.PAGNativeAd
import com.bytedance.sdk.openadsdk.api.nativeAd.PAGNativeAdInteractionListener
import com.bytedance.sdk.openadsdk.api.nativeAd.PAGNativeAdLoadListener
import com.bytedance.sdk.openadsdk.api.nativeAd.PAGNativeRequest
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.StandardMessageCodec
import io.flutter.plugin.platform.PlatformView
import io.flutter.plugin.platform.PlatformViewFactory
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class PangleNativeFactory(private val messenger: BinaryMessenger) :
    PlatformViewFactory(StandardMessageCodec.INSTANCE) {
    override fun create(context: Context, viewId: Int, args: Any?): PlatformView {
        @Suppress("UNCHECKED_CAST")
        val params = args as? Map<String, Any?> ?: emptyMap()
        val waves = (params["placement"] as? String) == "waves"
        return PangleNativeView(context, viewId, messenger, waves)
    }

    companion object {
        const val VIEW_TYPE = "com.afrovision.afrovision/pangle_native"
    }
}

/**
 * Native ad card styled to the app's dark navy/gold theme. Same readiness
 * gate and 3-attempt (0s/+2s/+4s) load policy as the banner.
 */
class PangleNativeView(
    private val ctx: Context,
    viewId: Int,
    messenger: BinaryMessenger,
    waves: Boolean,
) : PlatformView {
    private val root = FrameLayout(ctx)
    private val channel = MethodChannel(messenger, "com.afrovision.afrovision/pangle_view_$viewId")
    private val main = PangleAdsManager.main
    private var ad: PAGNativeAd? = null
    private var disposed = false
    private var pendingRetry: Runnable? = null
    private var state = "loading"
    private val ids = if (waves) PangleIds.NATIVE_WAVES else PangleIds.NATIVE_ADVANCED
    private val startOffset = PangleIds.nextStart(if (waves) "native_waves" else "native_advanced")
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
        PAGNativeAd.loadAd(placementId, PAGNativeRequest(), object : PAGNativeAdLoadListener {
            override fun onError(code: Int, message: String?) {
                main.post { handleError(attempt, code, message) }
            }

            private fun handleError(attempt: Int, code: Int, message: String?) {
                Log.w(PangleAdsManager.TAG, "native($placementId) load failed [$attempt]: $code $message")
                if (disposed) return
                if (attempt < retryDelaysMs.size) {
                    val retry = Runnable { load(attempt + 1) }
                    pendingRetry = retry
                    main.postDelayed(retry, retryDelaysMs[attempt])
                } else {
                    fail()
                }
            }

            override fun onAdLoaded(loaded: PAGNativeAd) {
                main.post { handleLoaded(loaded) }
            }

            private fun handleLoaded(loaded: PAGNativeAd) {
                if (disposed) return
                Log.i(PangleAdsManager.TAG, "native($placementId) loaded")
                ad = loaded
                try {
                    bind(loaded)
                    succeed()
                } catch (e: Exception) {
                    Log.w(PangleAdsManager.TAG, "native bind failed", e)
                    fail()
                }
            }
        })
    }

    private fun dp(v: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), ctx.resources.displayMetrics).toInt()

    private fun bind(loaded: PAGNativeAd) {
        val data = loaded.nativeAdData
        root.removeAllViews()

        val card = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(12), dp(12), dp(12))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#101C42"))
                cornerRadius = dp(16).toFloat()
                setStroke(dp(1), Color.parseColor("#26FFFFFF"))
            }
        }

        // Header: icon + title + "Sponsored"
        val header = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val icon = ImageView(ctx).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#1A2B5C"))
                cornerRadius = dp(10).toFloat()
            }
            clipToOutline = true
        }
        header.addView(icon, LinearLayout.LayoutParams(dp(40), dp(40)))
        data.icon?.imageUrl?.takeIf { it.isNotBlank() }?.let { loadBitmap(it, icon) }

        val titles = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
        val title = TextView(ctx).apply {
            text = data.title ?: ""
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setTypeface(typeface, Typeface.BOLD)
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
        }
        val tag = TextView(ctx).apply {
            text = "Sponsored"
            setTextColor(Color.parseColor("#99FFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
        }
        titles.addView(title)
        titles.addView(tag)
        header.addView(
            titles,
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                leftMargin = dp(10)
            },
        )
        data.adLogoView?.let { logo ->
            (logo.parent as? ViewGroup)?.removeView(logo)
            header.addView(logo, LinearLayout.LayoutParams(dp(28), dp(28)))
        }
        card.addView(header, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        val desc = TextView(ctx).apply {
            text = data.description ?: ""
            setTextColor(Color.parseColor("#CCFFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.END
        }
        card.addView(
            desc,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(8)
                bottomMargin = dp(8)
            },
        )

        val media = data.mediaView
        if (media != null) {
            (media.parent as? ViewGroup)?.removeView(media)
            card.addView(media, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        } else {
            card.addView(View(ctx), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        }

        val cta = TextView(ctx).apply {
            text = data.buttonText?.takeIf { it.isNotBlank() } ?: "Learn more"
            gravity = Gravity.CENTER
            setTextColor(Color.parseColor("#26170A"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setTypeface(typeface, Typeface.BOLD)
            background = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(Color.parseColor("#F5C76A"), Color.parseColor("#D9A441")),
            ).apply { cornerRadius = dp(12).toFloat() }
        }
        card.addView(
            cta,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(42)).apply { topMargin = dp(10) },
        )

        root.addView(card, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        val clickable = arrayListOf<View>(cta, title, desc, icon)
        val creative = arrayListOf<View>()
        media?.let { creative.add(it) }
        loaded.registerViewForInteraction(
            root,
            clickable,
            creative,
            null,
            object : PAGNativeAdInteractionListener {
                override fun onAdShowed() {}
                override fun onAdClicked() {}
                override fun onAdDismissed() {}
            },
        )
    }

    private fun loadBitmap(url: String, target: ImageView) {
        IMAGE_POOL.execute {
            try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 5000
                conn.readTimeout = 5000
                val bmp: Bitmap? = conn.inputStream.use { BitmapFactory.decodeStream(it) }
                if (bmp != null) main.post { if (!disposed) target.setImageBitmap(bmp) }
            } catch (_: Exception) {
            }
        }
    }

    override fun getView(): View = root

    override fun dispose() {
        disposed = true
        channel.setMethodCallHandler(null)
        PangleAdsManager.cancelWaiter(start)
        pendingRetry?.let { main.removeCallbacks(it) }
        pendingRetry = null
        ad = null
        root.removeAllViews()
    }

    companion object {
        private val IMAGE_POOL = Executors.newFixedThreadPool(2)
    }
}
