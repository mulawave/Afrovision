package com.afrovision.tv.player

import android.app.Application
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.afrovision.tv.data.PlayerMedia
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class PlayerViewModel(application: Application) : AndroidViewModel(application) {

    val player: ExoPlayer

    private val _currentMedia = mutableStateOf<PlayerMedia?>(null)
    val currentMedia by _currentMedia

    private val _isLive = mutableStateOf(false)
    val isLive by _isLive

    private val _isPlaying = mutableStateOf(false)
    val isPlaying by _isPlaying

    private val _isLoading = mutableStateOf(false)
    val isLoading by _isLoading

    private val _progress = mutableLongStateOf(0L)
    val progress by _progress

    private val _duration = mutableLongStateOf(0L)
    val duration by _duration

    private val _currentQuality = mutableStateOf("Auto")
    val currentQuality by _currentQuality

    private var progressJob: Job? = null

    init {
        player = ExoPlayer.Builder(application)
            .setSeekBackIncrementMs(15_000)
            .setSeekForwardIncrementMs(15_000)
            .build()
            .apply {
                playWhenReady = true
                addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(playing: Boolean) {
                        _isPlaying.value = playing
                    }

                    override fun onIsLoadingChanged(loading: Boolean) {
                        _isLoading.value = loading
                    }

                    override fun onPlaybackStateChanged(state: Int) {
                        if (state == Player.STATE_READY) {
                            _duration.value = player.duration.coerceAtLeast(0L)
                        }
                    }
                })
            }

        startProgressLoop()
    }

    fun play(media: PlayerMedia) {
        _currentMedia.value = media
        _isLive.value = media.isLive

        val url = media.streamUrl?.takeIf { it.isNotBlank() }
            ?: media.externalUrl?.takeIf { it.isNotBlank() }
            ?: return

        val uri = Uri.parse(url)
        val mediaItem = MediaItem.Builder()
            .setUri(uri)
            .setMimeType(
                when {
                    url.contains(".m3u8") -> "application/x-mpegURL"
                    url.contains(".mpd") -> "application/dash+xml"
                    else -> null
                }
            )
            .build()

        player.setMediaItem(mediaItem)
        player.prepare()
        if (media.progress > 0 && !media.isLive) {
            player.seekTo(media.progress)
        }
        player.playWhenReady = true
    }

    fun seekTo(positionMs: Long) {
        player.seekTo(positionMs.coerceIn(0, _duration.value))
    }

    fun togglePlayPause() {
        if (player.isPlaying) player.pause() else player.play()
    }

    fun skipForward() {
        player.seekForward()
    }

    fun skipBackward() {
        player.seekBack()
    }

    fun selectTrack(type: Int, groupIndex: Int, trackIndex: Int) {
        // Placeholder for quality/subtitle track selection.
    }

    fun release() {
        progressJob?.cancel()
        player.release()
    }

    private fun startProgressLoop() {
        progressJob = viewModelScope.launch {
            while (true) {
                delay(1_000)
                _progress.value = player.currentPosition.coerceAtLeast(0L)
                _duration.value = if (player.duration == C.TIME_UNSET) 0L else player.duration.coerceAtLeast(0L)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        release()
    }
}
