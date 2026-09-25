package com.afrovision.tv.data

import com.afrovision.tv.data.api.model.Channel
import com.afrovision.tv.data.api.model.LibraryFeedItem
import com.afrovision.tv.data.api.model.Movie
import com.afrovision.tv.data.api.model.Series
import com.afrovision.tv.data.api.model.WatchProgress
import com.afrovision.tv.data.api.model.Wave

fun Channel.toMediaCard() = MediaCard(
    id = id,
    title = name,
    subtitle = description ?: "",
    imageUrl = posterUrl,
    mediaType = "channel",
    streamUrl = streamUrl,
    externalUrl = externalUrl,
    badge = if (isLive) "LIVE" else "",
    channelNumber = channelNumber
)

fun Movie.toMediaCard() = MediaCard(
    id = id,
    title = title,
    subtitle = description ?: "",
    imageUrl = posterUrl,
    mediaType = "movie",
    streamUrl = streamUrl,
    externalUrl = externalUrl,
    duration = (duration ?: 0).toLong()
)

fun Series.toMediaCard() = MediaCard(
    id = id,
    title = title,
    subtitle = description ?: "",
    imageUrl = posterUrl,
    mediaType = "series"
)

fun LibraryFeedItem.toMediaCard() = MediaCard(
    id = id,
    title = title,
    subtitle = subtitle ?: author ?: "",
    imageUrl = coverAssetUrl,
    mediaType = "library",
    badge = contentType.replaceFirstChar { it.uppercase() },
    channelId = channelId
)

fun Wave.toMediaCard() = MediaCard(
    id = id,
    title = title,
    subtitle = creatorName ?: description ?: "",
    imageUrl = thumbnailUrl,
    mediaType = "wave",
    streamUrl = streamUrl,
    externalUrl = externalUrl,
    // Backend's wave.duration is seconds (mobile renders it as "${duration}s"
    // directly); MediaCard.duration is milliseconds everywhere else in this
    // app (toPlayerMedia() feeds it straight into ExoPlayer.seekTo()).
    duration = duration * 1000L
)

// Continue Watching cards. The backend only records progress for "movie"
// and "episode" (progress.controller.js VALID_MEDIA_TYPES). An episode card
// keeps its own id (not the series id) plus seriesId/channelId, so tapping it
// can fetch and resume that exact episode. duration is milliseconds, like
// every other MediaCard - toPlayerMedia() turns progress * duration into the
// ExoPlayer seek position, so seconds here resumed ~1000x too early.
fun WatchProgress.toMediaCard(movie: Movie): MediaCard {
    val totalSeconds = if (durationSeconds > 0) durationSeconds else (movie.duration ?: 0).toLong()
    return MediaCard(
        id = movieId ?: movie.id,
        title = movie.title,
        subtitle = movie.description ?: "",
        imageUrl = movie.posterUrl,
        progress = if (totalSeconds > 0) positionSeconds.toFloat() / totalSeconds else 0f,
        mediaType = "movie",
        streamUrl = movie.streamUrl,
        externalUrl = movie.externalUrl,
        duration = totalSeconds * 1000L,
        channelId = channelId
    )
}

fun WatchProgress.toMediaCard(): MediaCard {
    val pct = if (durationSeconds > 0) positionSeconds.toFloat() / durationSeconds else 0f
    return MediaCard(
        id = (if (mediaType == "episode") episodeId else movieId) ?: "",
        title = title,
        subtitle = episodeTitle ?: "",
        imageUrl = posterUrl,
        progress = pct,
        mediaType = mediaType,
        duration = durationSeconds * 1000L,
        channelId = channelId,
        seriesId = seriesId
    )
}

fun MediaCard.toPlayerMedia() = PlayerMedia(
    id = id,
    title = title,
    streamUrl = streamUrl,
    externalUrl = externalUrl,
    isLive = mediaType == "channel",
    progress = (progress * duration).toLong(),
    duration = duration,
    mediaType = mediaType,
    channelId = channelId,
    seriesId = seriesId
)
