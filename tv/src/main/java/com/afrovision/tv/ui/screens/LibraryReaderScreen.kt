package com.afrovision.tv.ui.screens

import com.afrovision.tv.ui.components.rememberCacheableImageRequest

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.api.model.LibraryProgress
import com.afrovision.tv.data.api.model.ReaderManifest
import com.afrovision.tv.data.api.model.ReaderSpread
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne

/** Mirrors the website reader's normalizePages(): supports both `pages[]` and index-based `pageImageUrls[]`. */
private fun normalizePages(manifest: ReaderManifest): List<com.afrovision.tv.data.api.model.ReaderPage> {
    val pages = manifest.pages
    if (!pages.isNullOrEmpty()) {
        val hasUrls = pages.any { it.imageUrl.isNotBlank() }
        if (hasUrls) return pages
        val urls = manifest.pageImageUrls
        if (!urls.isNullOrEmpty()) {
            return pages.map { p ->
                p.copy(imageUrl = urls.getOrNull(p.pageNumber - 1) ?: "")
            }
        }
        return pages
    }
    val urls = manifest.pageImageUrls
    if (!urls.isNullOrEmpty()) {
        return urls.mapIndexed { i, url -> com.afrovision.tv.data.api.model.ReaderPage(pageNumber = i + 1, imageUrl = url) }
    }
    return emptyList()
}

/** Mirrors the website reader's buildFallbackSpreads(): page 1 alone (cover), then two-up from page 2. */
private fun buildFallbackSpreads(totalPages: Int): List<ReaderSpread> {
    val out = mutableListOf<ReaderSpread>()
    var idx = 0
    if (totalPages > 0) {
        out.add(ReaderSpread(spreadIndex = idx++, leftPageNumber = null, rightPageNumber = 1))
    }
    var p = 2
    while (p <= totalPages) {
        out.add(
            ReaderSpread(
                spreadIndex = idx++,
                leftPageNumber = p,
                rightPageNumber = if (p + 1 <= totalPages) p + 1 else null
            )
        )
        p += 2
    }
    return out
}

/**
 * Mirrors the website's channel-scoped flip reader (see
 * website/src/app/channel/[id]/library/[itemId]/page.tsx): same manifest
 * shape (spreads of left/right page numbers), same autosaved progress, same
 * "single cover page, then two-page spreads" layout - adapted for a D-pad
 * instead of a mouse/touch, and without the website's true CSS backface-
 * visibility 3D flip (Compose has no equivalent), using a rotationY page
 * turn instead.
 */
@Composable
fun LibraryReaderScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val channelId = viewModel.readerChannelId
    val itemId = viewModel.readerItemId

    BackHandler { viewModel.closeReader() }

    if (channelId == null || itemId == null) {
        LaunchedEffect(Unit) { viewModel.closeReader() }
        return
    }

    val detailState = viewModel.readerDetail
    val manifestState = viewModel.readerManifest

    var currentSpreadIndex by remember(itemId) { mutableStateOf(0) }
    var initializedFromProgress by remember(itemId) { mutableStateOf(false) }
    var flipAngle by remember { mutableStateOf(0f) }
    val animatedFlip by animateFloatAsState(flipAngle, tween(280), label = "pageFlip")

    // Seed the starting spread from saved progress, once, when detail loads.
    LaunchedEffect(detailState) {
        if (!initializedFromProgress && detailState is LoadState.Success) {
            currentSpreadIndex = detailState.data.progress?.currentSpreadIndex ?: 0
            initializedFromProgress = true
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color(0xFF08091A))) {
        when {
            detailState is LoadState.Loading || manifestState is LoadState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = nocturne.gold)
                        Text(
                            text = "Opening your book…",
                            color = nocturne.textFaint,
                            fontSize = 18.sp,
                            modifier = Modifier.padding(top = 16.dp)
                        )
                    }
                }
            }
            detailState is LoadState.Error || manifestState is LoadState.Error -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    com.afrovision.tv.ui.components.ConnectionErrorCard(
                        message = "Unable to open this book.",
                        onRetry = { viewModel.openReaderItem(channelId, itemId) }
                    )
                }
            }
            detailState is LoadState.Success && manifestState is LoadState.Success -> {
                val detail = detailState.data
                val manifest = manifestState.data
                val pages = normalizePages(manifest)
                val pagesByNumber = remember(pages) { pages.associateBy { it.pageNumber } }
                val spreads = remember(manifest, detail) {
                    manifest.spreads?.takeIf { it.isNotEmpty() }
                        ?: buildFallbackSpreads(detail.item.totalPages ?: pages.size)
                }
                val clampedIndex = currentSpreadIndex.coerceIn(0, (spreads.size - 1).coerceAtLeast(0))
                val spread = spreads.getOrNull(clampedIndex)
                val hasPrev = clampedIndex > 0
                val hasNext = clampedIndex < spreads.size - 1

                fun saveProgress(index: Int) {
                    val s = spreads.getOrNull(index) ?: return
                    viewModel.saveReaderProgress(
                        channelId, itemId,
                        LibraryProgress(
                            currentSpreadIndex = index,
                            currentPageLeft = s.leftPageNumber,
                            currentPageRight = s.rightPageNumber,
                            isCompleted = index >= spreads.size - 1
                        )
                    )
                }

                fun goNext() {
                    if (hasNext) {
                        TvSoundManager.play("row")
                        flipAngle -= 180f
                        currentSpreadIndex = clampedIndex + 1
                        saveProgress(clampedIndex + 1)
                    } else {
                        val nextId = detail.navigation.nextItemId
                        if (nextId != null) {
                            TvSoundManager.play("screen")
                            viewModel.openReaderItem(channelId, nextId)
                        }
                    }
                }

                fun goPrev() {
                    if (hasPrev) {
                        TvSoundManager.play("row")
                        flipAngle += 180f
                        currentSpreadIndex = clampedIndex - 1
                        saveProgress(clampedIndex - 1)
                    } else {
                        val prevId = detail.navigation.previousItemId
                        if (prevId != null) {
                            TvSoundManager.play("screen")
                            viewModel.openReaderItem(channelId, prevId)
                        }
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .onKeyEvent { event ->
                            if (event.type != androidx.compose.ui.input.key.KeyEventType.KeyDown) return@onKeyEvent false
                            when (event.key) {
                                Key.DirectionRight -> { goNext(); true }
                                Key.DirectionLeft -> { goPrev(); true }
                                else -> false
                            }
                        }
                ) {
                    // Top bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 48.dp, vertical = 20.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text(
                            text = detail.item.title,
                            color = nocturne.text,
                            fontSize = 24.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = "${clampedIndex + 1} / ${spreads.size.coerceAtLeast(1)}",
                            color = nocturne.textHint,
                            fontSize = 18.sp
                        )
                    }

                    // Reading area
                    Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        val isSingleCover = spread != null &&
                            (spread.leftPageNumber == null) != (spread.rightPageNumber == null)

                        Box(
                            modifier = Modifier
                                .height(600.dp)
                                .then(if (isSingleCover) Modifier.aspectRatio(1f / 1.41f) else Modifier.aspectRatio(2f / 1.41f))
                                .graphicsLayer {
                                    rotationY = animatedFlip % 360f
                                    cameraDistance = 24f * density
                                }
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0xFFFFFBF3))
                        ) {
                            if (isSingleCover) {
                                val pageNum = spread?.rightPageNumber ?: spread?.leftPageNumber
                                ReaderPageSlot(page = pageNum?.let { pagesByNumber[it] }, pageNum = pageNum)
                            } else {
                                Row(modifier = Modifier.fillMaxSize()) {
                                    Box(modifier = Modifier.weight(1f).fillMaxHeight().background(Color(0xFFFAF4E8))) {
                                        ReaderPageSlot(
                                            page = spread?.leftPageNumber?.let { pagesByNumber[it] },
                                            pageNum = spread?.leftPageNumber
                                        )
                                    }
                                    Box(
                                        modifier = Modifier
                                            .width(2.dp)
                                            .fillMaxHeight()
                                            .background(Color(0xFFC4A882).copy(alpha = 0.3f))
                                    )
                                    Box(modifier = Modifier.weight(1f).fillMaxHeight().background(Color(0xFFFFFBF3))) {
                                        ReaderPageSlot(
                                            page = spread?.rightPageNumber?.let { pagesByNumber[it] },
                                            pageNum = spread?.rightPageNumber
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Bottom bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 48.dp, vertical = 20.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        ReaderNavButton(label = "← Previous", enabled = hasPrev || detail.navigation.previousItemId != null, onClick = ::goPrev)
                        Box(
                            modifier = Modifier
                                .width(320.dp)
                                .height(4.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(Color.White.copy(alpha = 0.14f))
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(((clampedIndex + 1).toFloat() / spreads.size.coerceAtLeast(1)).coerceIn(0f, 1f))
                                    .fillMaxHeight()
                                    .background(nocturne.accent)
                            )
                        }
                        ReaderNavButton(
                            label = if (hasNext || detail.navigation.nextItemId != null) "Next →" else "Finish ✓",
                            enabled = hasNext || detail.navigation.nextItemId != null,
                            onClick = ::goNext
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ReaderPageSlot(page: com.afrovision.tv.data.api.model.ReaderPage?, pageNum: Int?) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        if (page?.imageUrl?.isNotBlank() == true) {
            AsyncImage(
                model = rememberCacheableImageRequest(page.imageUrl),
                contentDescription = pageNum?.let { "Page $it" },
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize()
            )
        } else if (pageNum != null) {
            Text(text = "Page $pageNum", color = Color(0xFF9A8A7A), fontSize = 14.sp)
        }
    }
}

/**
 * A status readout, not a separate focus target - page turning is driven
 * by D-pad left/right on the reading area itself (see onKeyEvent above).
 * [onClick] exists so this can still be wired to a click if a remote's
 * center button lands here in a future focus pass; unused for now.
 */
@Composable
private fun ReaderNavButton(label: String, enabled: Boolean, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(nocturne.radiusMd.dp))
            .background(if (enabled) nocturne.accent900 else Color.Transparent)
            .padding(horizontal = 22.dp, vertical = 12.dp)
    ) {
        Text(
            text = label,
            color = if (enabled) nocturne.accentLight else nocturne.textFaint,
            fontSize = 18.sp
        )
    }
}
