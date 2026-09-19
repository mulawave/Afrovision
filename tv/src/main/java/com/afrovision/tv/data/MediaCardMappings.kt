package com.afrovision.tv.data

import com.afrovision.tv.data.api.model.Channel
import com.afrovision.tv.data.api.model.LibraryItem
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

fun LibraryItem.toMediaCard() = MediaCard(
    id = id,
    title = title,
    subtitle = subtitle ?: author ?: "",
    imageUrl = coverAssetUrl,
    mediaType = "library",
    badge = contentType.replaceFirstChar { it.uppercase() }
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

fun WatchProgress.toMediaCard(channel: Channel): MediaCard {
    val total = if (duration > 0) duration else 0L
    return MediaCard(
        id = mediaId,
        title = channel.name,
        subtitle = channel.description ?: "",
        imageUrl = channel.posterUrl,
        progress = if (total > 0) position.toFloat() / total else 0f,
        badge = if (channel.isLive) "LIVE" else "",
        mediaType = "channel",
        streamUrl = channel.streamUrl,
        externalUrl = channel.externalUrl,
        duration = total
    )
}

fun WatchProgress.toMediaCard(movie: Movie): MediaCard {
    val total = if (duration > 0) duration else (movie.duration ?: 0).toLong()
    return MediaCard(
        id = mediaId,
        title = movie.title,
        subtitle = movie.description ?: "",
        imageUrl = movie.posterUrl,
        progress = if (total > 0) position.toFloat() / total else 0f,
        badge = "",
        mediaType = "movie",
        streamUrl = movie.streamUrl,
        externalUrl = movie.externalUrl,
        duration = total
    )
}

fun WatchProgress.toMediaCard(series: Series): MediaCard {
    val total = if (duration > 0) duration else 0L
    return MediaCard(
        id = mediaId,
        title = series.title,
        subtitle = series.description ?: "",
        imageUrl = series.posterUrl,
        progress = if (total > 0) position.toFloat() / total else 0f,
        badge = "",
        mediaType = "series",
        streamUrl = null,
        externalUrl = null,
        duration = total
    )
}

fun WatchProgress.toMediaCard(wave: Wave): MediaCard {
    val total = duration
    return MediaCard(
        id = mediaId,
        title = wave.title,
        subtitle = wave.creatorName ?: wave.description ?: "",
        imageUrl = wave.thumbnailUrl,
        progress = if (total > 0) position.toFloat() / total else 0f,
        badge = "",
        mediaType = "wave",
        streamUrl = wave.streamUrl,
        externalUrl = wave.externalUrl,
        duration = total
    )
}

fun WatchProgress.toMediaCard(): MediaCard {
    val pct = if (this.duration > 0) this.position.toFloat() / this.duration else 0f
    return MediaCard(
        id = mediaId,
        title = mediaId,
        subtitle = mediaType,
        imageUrl = null,
        progress = pct,
        mediaType = mediaType,
        duration = this.duration
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
    mediaType = mediaType
)
