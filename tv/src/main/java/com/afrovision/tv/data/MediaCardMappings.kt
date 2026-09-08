package com.afrovision.tv.data

import com.afrovision.tv.data.api.model.Channel
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
    badge = if (isLive) "LIVE" else ""
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

fun Wave.toMediaCard() = MediaCard(
    id = id,
    title = title,
    subtitle = creatorName ?: description ?: "",
    imageUrl = thumbnailUrl,
    mediaType = "wave",
    streamUrl = streamUrl,
    externalUrl = externalUrl
)

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
