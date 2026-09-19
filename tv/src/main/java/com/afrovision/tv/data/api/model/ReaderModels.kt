package com.afrovision.tv.data.api.model

import kotlinx.serialization.Serializable

/**
 * Shapes mirror the backend exactly:
 *  - GET /channels/{channelId}/library/{itemId}                  -> LibraryItemDetailResponse
 *  - GET /channels/{channelId}/library/{itemId}/reader-manifest  -> ReaderManifestResponse
 *  - GET|PUT /channels/{channelId}/library/{itemId}/progress     -> LibraryProgressResponse
 *
 * The manifest itself is NOT served by our API — the endpoint hands back a
 * `manifestUrl` pointing at a public GCS JSON file, which ReaderManifestFetcher
 * loads directly. That file is [ReaderManifest].
 */

@Serializable
data class LibraryItem(
    val id: String = "",
    val channelId: String = "",
    val title: String = "",
    val description: String? = null,
    val coverImageUrl: String? = null,
    val seriesId: String? = null,
    val totalPages: Int? = null,
    val status: String? = null
)

@Serializable
data class LibraryFeedPage(
    val items: List<LibraryItem> = emptyList()
)

@Serializable
data class LibraryFeedResponse(
    val success: Boolean = false,
    val data: LibraryFeedPage = LibraryFeedPage()
)

@Serializable
data class LibraryNavigation(
    val previousItemId: String? = null,
    val nextItemId: String? = null
)

/** Backend sends null for fields that have not been read yet. */
@Serializable
data class LibraryProgress(
    val currentSpreadIndex: Int = 0,
    val currentPageLeft: Int? = null,
    val currentPageRight: Int? = null,
    val isCompleted: Boolean = false
)

@Serializable
data class LibraryItemDetail(
    val item: LibraryItem = LibraryItem(),
    val progress: LibraryProgress? = null,
    val navigation: LibraryNavigation = LibraryNavigation()
)

@Serializable
data class LibraryItemDetailResponse(
    val success: Boolean = false,
    val data: LibraryItemDetail? = null
)

@Serializable
data class ReaderManifestRef(
    val manifestUrl: String = "",
    val itemId: String = "",
    val totalPages: Int? = null
)

@Serializable
data class ReaderManifestResponse(
    val success: Boolean = false,
    val data: ReaderManifestRef? = null
)

@Serializable
data class LibraryProgressResponse(
    val success: Boolean = false,
    val data: LibraryProgress? = null
)

/**
 * The GCS manifest document. `imageUrl` is null in the manifest for
 * PDF-sourced books, so it is decoded with coerceInputValues into "" and the
 * reader falls back to the index-based [pageImageUrls] list.
 */
@Serializable
data class ReaderPage(
    val pageNumber: Int = 0,
    val imageUrl: String = ""
)

@Serializable
data class ReaderSpread(
    val spreadIndex: Int = 0,
    val leftPageNumber: Int? = null,
    val rightPageNumber: Int? = null
)

@Serializable
data class ReaderManifest(
    val version: Int = 1,
    val sourceType: String = "",
    val pdfUrl: String? = null,
    val pageImageUrls: List<String>? = null,
    val totalPages: Int = 0,
    val pages: List<ReaderPage>? = null,
    val spreads: List<ReaderSpread>? = null
)
