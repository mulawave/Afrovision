package com.afrovision.tv.data.api.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class HomepageContentResponse(
    val homepage: HomepageContent? = null,
    val data: HomepageContent? = null
)

@Serializable
data class HomepageContent(
    val sections: List<HomepageSection> = emptyList()
)

@Serializable
data class HomepageSection(
    val key: String = "",
    val enabled: Boolean = true,
    @SerialName("sort_order") val sortOrder: Int = 0,
    @SerialName("auto_rotate_ms") val autoRotateMs: Long = 8000L,
    @SerialName("auto_slide") val autoSlide: Boolean = false,
    val slides: List<HomepageHeroSlide> = emptyList(),
    val items: List<HomepageFeaturedItem> = emptyList(),
    val title: String = "",
    val subtitle: String = "",
    @SerialName("cta_label") val ctaLabel: String = "",
    @SerialName("cta_href") val ctaHref: String = ""
)

@Serializable
data class HomepageFeaturedItem(
    val id: String = "",
    @SerialName("channel_id") val channelId: String = "",
    val name: String = "",
    val category: String = "",
    val viewers: Int = 0,
    @SerialName("is_live") val isLive: Boolean = false,
    @SerialName("is_premium_channel") val isPremiumChannel: Boolean = false,
    val href: String = "",
    @SerialName("banner_url") val bannerUrl: String? = null,
    @SerialName("logo_url") val logoUrl: String? = null
)

@Serializable
data class HomepageHeroSlide(
    val id: String = "",
    val type: String = "",
    val icon: String = "",
    val subtitle: String = "",
    val title: String = "",
    val description: String = "",
    val cta: HomepageCta? = null,
    @SerialName("secondary_cta") val secondaryCta: HomepageCta? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("is_live") val isLive: Boolean = false,
    val viewers: Int? = null,
    @SerialName("channel_name") val channelName: String = ""
)

@Serializable
data class HomepageCta(
    val label: String = "",
    val href: String = ""
)
