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

/** mediaType "library" is what RailRow uses to open the reader instead of the player. */
fun com.afrovision.tv.data.api.model.LibraryItem.toMediaCard() = MediaCard(
    id = id,
    channelId = channelId,
    title = title,
    subtitle = description ?: "",
    imageUrl = coverImageUrl,
    mediaType = "library"
)

fun WatchProgress.toMediaCard(): MediaCard {
    val pct = if (durationSeconds > 0) positionSeconds.toFloat() / durationSeconds else 0f
    return MediaCard(
        // Episodes resolve to the parent series card, so the id that matters
        // for resuming is the episode's; movies carry their own.
        id = episodeId ?: movieId ?: seriesId ?: "",
        title = title,
        subtitle = episodeTitle ?: "",
        imageUrl = posterUrl,
        progress = pct.coerceIn(0f, 1f),
        mediaType = mediaType,
        duration = durationSeconds
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
