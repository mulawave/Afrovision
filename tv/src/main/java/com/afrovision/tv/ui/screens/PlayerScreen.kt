package com.afrovision.tv.ui.screens

import android.net.Uri
import android.view.KeyEvent
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.afrovision.tv.data.PlayerMedia
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.ui.navigation.Screen
import com.afrovision.tv.ui.theme.LocalNocturne
import kotlinx.coroutines.delay

@Composable
fun PlayerScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val context = LocalContext.current
    val media = viewModel.playerMedia ?: return run { viewModel.closePlayer() }

    if (media.mediaType == "trailer" || isYouTubeUrl(media.externalUrl) || isYouTubeUrl(media.streamUrl)) {
        TrailerPlayer(viewModel, media)
        return
    }

    val player = remember { ExoPlayer.Builder(context).build() }
    var isPlaying by remember { mutableStateOf(true) }
    var showOverlay by remember { mutableStateOf(true) }
    var position by remember { mutableLongStateOf(0L) }
    var duration by remember { mutableLongStateOf(0L) }

    LaunchedEffect(media) {
        val url = media.streamUrl ?: media.externalUrl ?: return@LaunchedEffect
        player.setMediaItem(MediaItem.fromUri(url))
        player.prepare()
        player.playWhenReady = true
        if (media.progress > 0 && !media.isLive) player.seekTo(media.progress)
    }

    LaunchedEffect(showOverlay) {
        if (showOverlay) {
            delay(5000)
            showOverlay = false
        }
    }

    LaunchedEffect(player) {
        while (true) {
            delay(1000)
            position = player.currentPosition.coerceAtLeast(0L)
            duration = player.duration.coerceAtLeast(0L)
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            player.release()
        }
    }

    BackHandler { viewModel.closePlayer() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .onKeyEvent { event ->
                when (event.nativeKeyEvent.keyCode) {
                    KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                        if (player.isPlaying) player.pause() else player.play()
                        true
                    }
                    KeyEvent.KEYCODE_DPAD_RIGHT -> {
                        player.seekForward()
                        true
                    }
                    KeyEvent.KEYCODE_DPAD_LEFT -> {
                        player.seekBack()
                        true
                    }
                    else -> false
                }
            }
    ) {
        AndroidView(
            factory = {
                PlayerView(it).apply {
                    this.player = player
                    useController = false
                    setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        val overlayAlpha by animateFloatAsState(if (showOverlay) 1f else 0f, label = "overlay")

        Box(modifier = Modifier.fillMaxSize().alpha(overlayAlpha)) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(48.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = media.title,
                        color = Color.White,
                        fontSize = 38.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (!media.isLive) {
                        Text(
                            text = "${formatTime(position)} / ${formatTime(duration)}",
                            color = Color.White.copy(alpha = 0.8f),
                            fontSize = 20.sp
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalAlignment = Alignment.CenterVertically) {
                        PlayerIcon(
                            icon = Icons.Filled.PlayArrow,
                            onClick = { if (player.isPlaying) player.pause() else player.play() }
                        )
                        Text(
                            text = if (player.isPlaying) "PAUSE" else "PLAY",
                            color = Color.White,
                            fontSize = 20.sp
                        )
                    }
                    Text(
                        text = if (media.isLive) "LIVE" else "VOD",
                        color = nocturne.accent,
                        fontSize = 20.sp
                    )
                }

                if (!media.isLive && duration > 0) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .background(Color.White.copy(alpha = 0.2f))
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(position.toFloat() / duration.coerceAtLeast(1L))
                                .fillMaxHeight()
                                .background(nocturne.accent)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PlayerIcon(icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(64.dp)
            .background(androidx.compose.ui.graphics.Color.Transparent)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(imageVector = icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(48.dp))
    }
}

private fun formatTime(ms: Long): String {
    val total = ms / 1000
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
}

@Composable
private fun TrailerPlayer(viewModel: TvViewModel, media: PlayerMedia) {
    val nocturne = LocalNocturne.current
    val url = media.externalUrl ?: media.streamUrl ?: return run { viewModel.closePlayer() }
    val html = remember(url) { buildEmbedHtml(url) }

    BackHandler { viewModel.closePlayer() }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.mediaPlaybackRequiresUserGesture = false
                    settings.userAgentString =
                        "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 " +
                        "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
                    settings.domStorageEnabled = true
                    webViewClient = WebViewClient()
                    loadDataWithBaseURL(
                        "https://www.youtube-nocookie.com",
                        html,
                        "text/html",
                        "UTF-8",
                        null
                    )
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(nocturne.background.copy(alpha = 0.45f))
                .padding(28.dp)
        ) {
            Text(
                text = media.title,
                color = Color.White,
                fontSize = 24.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

private fun isYouTubeUrl(url: String?): Boolean {
    val lower = url?.lowercase() ?: return false
    return lower.contains("youtube.com") ||
        lower.contains("youtube-nocookie.com") ||
        lower.contains("youtu.be")
}

private fun extractYouTubeVideoId(url: String): String? {
    return try {
        val parsed = Uri.parse(url)
        val host = parsed.host?.lowercase() ?: ""
        val segments = parsed.pathSegments

        if (host.contains("youtu.be") && segments.isNotEmpty()) {
            segments.first()
        } else {
            parsed.getQueryParameter("v")
                ?: segments.indexOf("embed").takeIf { it >= 0 && it + 1 < segments.size }
                    ?.let { segments[it + 1] }
                ?: segments.takeIf { it.size >= 2 && (it[0] == "live" || it[0] == "shorts") }
                    ?.let { it[1] }
        }
    } catch (_: Exception) {
        null
    }
}

private fun buildNocookieEmbedUrl(videoId: String): String {
    return Uri.Builder()
        .scheme("https")
        .authority("www.youtube-nocookie.com")
        .path("/embed/$videoId")
        .appendQueryParameter("autoplay", "1")
        .appendQueryParameter("controls", "1")
        .appendQueryParameter("mute", "0")
        .appendQueryParameter("playsinline", "1")
        .appendQueryParameter("enablejsapi", "1")
        .appendQueryParameter("rel", "0")
        .appendQueryParameter("iv_load_policy", "3")
        .appendQueryParameter("modestbranding", "1")
        .appendQueryParameter("origin", "https://www.youtube-nocookie.com")
        .build()
        .toString()
}

private fun buildEmbedHtml(url: String): String {
    val videoId = extractYouTubeVideoId(url)
    val src = if (!videoId.isNullOrBlank()) {
        buildNocookieEmbedUrl(videoId)
    } else if (isYouTubeUrl(url)) {
        url
    } else {
        url
    }

    return """<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
        iframe { width: 100%; height: 100%; border: 0; }
    </style>
</head>
<body>
    <iframe src="$src" allowfullscreen allow="autoplay; encrypted-media; fullscreen; picture-in-picture"></iframe>
</body>
</html>"""
}
