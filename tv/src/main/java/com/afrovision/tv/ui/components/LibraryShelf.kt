package com.afrovision.tv.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.afrovision.tv.data.api.model.ContinueReadingRecord
import com.afrovision.tv.data.api.model.LibraryFeedItem
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne

// Library content types (backend library.model.js contentTypes), in the
// order the category chips show them.
val LIBRARY_CATEGORIES = listOf(
    "comic" to "Comics",
    "magazine" to "Magazines",
    "book" to "Books",
    "other" to "Other"
)

private const val SHELF_COLUMNS = 6

// ── Library bookshelf ────────────────────────────────────────────────────

/**
 * Bookshelf used by both the public Library and Exclusive: a Continue
 * reading row, category chips (only for categories that have titles) and a
 * fixed-column grid of book covers.
 */
@Composable
fun LibraryShelf(
    library: List<LibraryFeedItem>,
    loading: Boolean,
    continueReading: List<ContinueReadingRecord>,
    emptyText: String,
    onOpen: (LibraryFeedItem) -> Unit
) {
    val nocturne = LocalNocturne.current
    var category by remember { mutableStateOf<String?>(null) }
    // Only categories that actually have titles get a chip.
    val presentCategories = LIBRARY_CATEGORIES.filter { (type, _) -> library.any { it.contentType == type } }
    val progressByItem = continueReading.associateBy { it.itemId }
    val shown = if (category == null) library else library.filter { it.contentType == category }

    Column(modifier = Modifier.fillMaxWidth().padding(top = 24.dp)) {
        if (library.isEmpty()) {
            ShelfMessage(if (loading) "Loading…" else emptyText)
            return@Column
        }

        val reading = continueReading.mapNotNull { rec -> rec.item?.let { rec to it } }
        if (reading.isNotEmpty()) {
            Text(
                text = "Continue reading",
                color = nocturne.text,
                fontSize = 28.sp,
                modifier = Modifier.padding(start = 60.dp, bottom = 12.dp)
            )
            LazyRow(
                contentPadding = PaddingValues(start = 60.dp, end = 60.dp, top = 6.dp, bottom = 18.dp),
                horizontalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                items(reading, key = { "cr-${it.second.id}" }) { (rec, item) ->
                    BookCover(
                        item = item,
                        progress = readingFraction(rec, item),
                        modifier = Modifier.width(170.dp),
                        onClick = { onOpen(item) }
                    )
                }
            }
        }

        Row(
            modifier = Modifier.padding(start = 60.dp, end = 60.dp, top = 6.dp, bottom = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            ShelfPill(label = "All · ${library.size}", selected = category == null, onClick = { category = null })
            presentCategories.forEach { (type, label) ->
                val count = library.count { it.contentType == type }
                ShelfPill(label = "$label · $count", selected = category == type, onClick = { category = type })
            }
        }

        // Grid: fixed columns, real rows. Every cell has the same width, so
        // a short last row stays left-aligned instead of stretching.
        shown.chunked(SHELF_COLUMNS).forEach { rowItems ->
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 60.dp, end = 60.dp, bottom = 28.dp),
                horizontalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                rowItems.forEach { item ->
                    BookCover(
                        item = item,
                        progress = progressByItem[item.id]?.let { readingFraction(it, item) },
                        modifier = Modifier.weight(1f),
                        onClick = { onOpen(item) }
                    )
                }
                repeat(SHELF_COLUMNS - rowItems.size) { Spacer(modifier = Modifier.weight(1f)) }
            }
        }
    }
}

/** Roughly how far through a title the reader is (two pages per spread after the cover). */
private fun readingFraction(record: ContinueReadingRecord, item: LibraryFeedItem): Float? {
    val total = item.totalPages ?: return null
    if (total <= 0) return null
    val pagesRead = (record.currentSpreadIndex * 2).coerceAtLeast(1)
    return (pagesRead.toFloat() / total).coerceIn(0.02f, 1f)
}

@Composable
private fun BookCover(item: LibraryFeedItem, progress: Float?, modifier: Modifier, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    val scale by animateFloatAsState(if (focused) 1.06f else 1f, label = "bookScale")
    val ring by animateColorAsState(if (focused) nocturne.gold else Color.White.copy(alpha = 0.08f), label = "bookRing")
    val categoryLabel = LIBRARY_CATEGORIES.firstOrNull { it.first == item.contentType }?.second?.removeSuffix("s")

    Column(modifier = modifier.scale(scale)) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .clip(RoundedCornerShape(10.dp))
                .background(nocturne.surfaceRaised)
                .border(if (focused) 3.dp else 1.dp, ring, RoundedCornerShape(10.dp))
                .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
        ) {
            val cover = rememberCacheableImageRequest(item.coverAssetUrl)
            if (cover != null) {
                AsyncImage(
                    model = cover,
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Brush.linearGradient(listOf(nocturne.surface, nocturne.surfaceRaised, nocturne.background))),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = item.title.take(2).uppercase(), color = nocturne.text.copy(alpha = 0.18f), fontSize = 44.sp)
                }
            }
            // Spine highlight along the left edge, like a real book.
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(5.dp)
                    .background(Brush.horizontalGradient(listOf(Color.Black.copy(alpha = 0.45f), Color.Transparent)))
            )
            if (categoryLabel != null) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(10.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color.Black.copy(alpha = 0.62f))
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(text = categoryLabel.uppercase(), color = nocturne.goldLight, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp)
                }
            }
            if (progress != null) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .fillMaxWidth()
                        .height(5.dp)
                        .background(Color.Black.copy(alpha = 0.55f))
                ) {
                    Box(modifier = Modifier.fillMaxWidth(progress).fillMaxHeight().background(nocturne.gold))
                }
            }
        }
        Text(
            text = item.title,
            color = if (focused) nocturne.goldLight else nocturne.text,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 10.dp)
        )
    }
}

@Composable
fun ShelfPill(label: String, selected: Boolean, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(
                when {
                    selected -> nocturne.gold.copy(alpha = 0.18f)
                    focused -> Color.White.copy(alpha = 0.06f)
                    else -> Color.Transparent
                }
            )
            .border(
                if (focused) 2.dp else if (selected) 1.dp else 0.dp,
                if (focused) nocturne.gold else nocturne.gold.copy(alpha = 0.5f),
                RoundedCornerShape(999.dp)
            )
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 10.dp)
    ) {
        Text(
            text = label,
            color = if (focused || selected) nocturne.goldLight else nocturne.textMuted,
            fontSize = 17.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
        )
    }
}

@Composable
private fun ShelfMessage(text: String) {
    val nocturne = LocalNocturne.current
    Box(modifier = Modifier.fillMaxWidth().height(220.dp), contentAlignment = Alignment.Center) {
        Text(text = text, color = nocturne.textFaint, fontSize = 22.sp)
    }
}
