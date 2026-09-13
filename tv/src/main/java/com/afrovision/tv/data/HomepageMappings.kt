package com.afrovision.tv.data

import com.afrovision.tv.BASE_URL
import com.afrovision.tv.R
import com.afrovision.tv.data.api.model.HomepageHeroSlide
import com.afrovision.tv.data.api.model.HomepageSection
import com.afrovision.tv.ui.components.HeroBadge
import com.afrovision.tv.ui.components.HeroSlide
import java.text.DecimalFormat

fun HomepageSection.toHeroSlides(): List<HeroSlide> {
    if (key != "hero" || !enabled) return emptyList()
    return slides.map { it.toHeroSlide() }
}

fun HomepageHeroSlide.toHeroSlide(): HeroSlide {
    val titleHighlight = title.split(". ").getOrNull(1)?.trim() ?: ""
    val iconName = icon?.trim()
    val mappedIcon = mapPhosphorIcon(iconName)
    val emoji = if (mappedIcon == null && !iconName.isNullOrBlank()) iconName else null

    val badges = buildList {
        if (isLive) add(HeroBadge("LIVE", isLive = true))
        if (!channelName.isNullOrBlank()) add(HeroBadge(channelName, icon = R.drawable.ic_ph_television_simple, emoji = if (mappedIcon == null) emoji else null))
        if (viewers != null) add(HeroBadge(formatViewers(viewers), icon = R.drawable.ic_ph_eye))
        if (!subtitle.isNullOrBlank()) {
            add(HeroBadge(subtitle, icon = mappedIcon, emoji = emoji))
        } else if (!description.isNullOrBlank() && description.length <= 40) {
            add(HeroBadge(description, icon = mappedIcon, emoji = emoji))
        }
    }

    return HeroSlide(
        title = title,
        titleHighlight = titleHighlight,
        subtitle = description,
        badges = badges,
        primaryLabel = cta?.label ?: "Watch",
        primaryIcon = mapPrimaryIcon(type, isLive),
        secondaryLabel = secondaryCta?.label,
        secondaryIcon = mapSecondaryIcon(type),
        imageUrl = imageUrl?.let { resolveAssetUrl(it) },
        showBookmark = false,
        href = cta?.href
    )
}

private fun formatViewers(count: Int): String {
    return when {
        count >= 1_000_000 -> String.format("%.1fM", count / 1_000_000.0)
        count >= 1_000 -> String.format("%.1fk", count / 1_000.0)
        else -> count.toString()
    }
}

fun resolveAssetUrl(path: String): String {
    val trimmed = path.trim()
    return when {
        trimmed.startsWith("http://") || trimmed.startsWith("https://") -> trimmed
        trimmed.startsWith("gs://") -> {
            val stripped = trimmed.removePrefix("gs://")
            val firstSlash = stripped.indexOf("/")
            if (firstSlash > 0) {
                val bucket = stripped.substring(0, firstSlash)
                val objectPath = stripped.substring(firstSlash + 1)
                "https://storage.googleapis.com/$bucket/$objectPath"
            } else {
                trimmed
            }
        }
        else -> "$BASE_URL${if (trimmed.startsWith("/")) trimmed else "/$trimmed"}"
    }
}

private fun mapPrimaryIcon(type: String, isLive: Boolean): Int {
    return when {
        isLive || type.contains("live", ignoreCase = true) -> R.drawable.ic_ph_broadcast_fill
        type.contains("trailer", ignoreCase = true) -> R.drawable.ic_ph_play
        type.contains("channel", ignoreCase = true) -> R.drawable.ic_ph_broadcast_fill
        type.contains("wave", ignoreCase = true) -> R.drawable.ic_ph_play_circle
        type.contains("challenge", ignoreCase = true) -> R.drawable.ic_ph_trophy
        else -> R.drawable.ic_ph_play
    }
}

private fun mapSecondaryIcon(type: String): Int {
    return when {
        type.contains("trailer", ignoreCase = true) -> R.drawable.ic_ph_info
        type.contains("live", ignoreCase = true) -> R.drawable.ic_ph_bell_simple
        else -> R.drawable.ic_ph_info
    }
}

private fun mapPhosphorIcon(icon: String?): Int? {
    if (icon.isNullOrBlank()) return null
    return when (icon.lowercase()) {
        "trophy" -> R.drawable.ic_ph_trophy
        "eye" -> R.drawable.ic_ph_eye
        "feed" -> R.drawable.ic_ph_feed
        "broadcast" -> R.drawable.ic_ph_broadcast_fill
        "television" -> R.drawable.ic_ph_television_simple
        "wifi" -> R.drawable.ic_ph_wifi_high
        "play" -> R.drawable.ic_ph_play
        "play-circle" -> R.drawable.ic_ph_play_circle
        "info" -> R.drawable.ic_ph_info
        "bell" -> R.drawable.ic_ph_bell_simple
        "bookmark" -> R.drawable.ic_ph_bookmark_simple
        "heart" -> R.drawable.ic_ph_heart
        "users" -> R.drawable.ic_ph_profile
        "coins" -> R.drawable.ic_ph_coins
        "star" -> R.drawable.ic_ph_trophy
        else -> null
    }
}
