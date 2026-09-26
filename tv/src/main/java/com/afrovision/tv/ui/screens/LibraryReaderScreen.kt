package com.afrovision.tv.ui.screens

import android.view.KeyEvent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.imageLoader
import coil.request.ImageRequest
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.api.model.LibraryFeedItem
import com.afrovision.tv.data.api.model.LibraryProgress
import com.afrovision.tv.data.api.model.ReaderManifest
import com.afrovision.tv.data.api.model.ReaderSpread
import com.afrovision.tv.data.imageCacheKey
import com.afrovision.tv.ui.components.rememberCacheableImageRequest
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

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

/** One page in reading order, with the spread it belongs to. */
private data class FlatPage(val pageNumber: Int, val spreadIndex: Int)

private val ZOOM_LEVELS = listOf(1f, 1.5f, 2f)
private const val PAN_STEP = 0.25f
private const val CONTROLS_AUTO_HIDE_MS = 6_000L
private const val PAGE_ASPECT = 1f / 1.414f

/**
 * Library reader for the TV remote, built on the website reader's feature
 * set (website/src/app/channel/[id]/library/[itemId]/page.tsx): two-page
 * spreads or single pages, zoom, page-turn animation, bookmarks shared with
 * the website, a finished screen with the next chapter and more from the
 * channel, adjacent-page preloading, and autosaved progress.
 *
 * Remote:
 * - Left/Right: turn pages (pan when zoomed)
 * - OK: zoom 100% → 150% → 200% → 100%
 * - Up/Down: pan when zoomed, otherwise open the controls
 * - Back: close panels, then reset zoom, then leave the reader
 *
 * Pages always fill the screen height (scaled down only if a two-page
 * spread would be wider than the screen), instead of a fixed-size box.
 */
@Composable
fun LibraryReaderScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val channelId = viewModel.readerChannelId
    val itemId = viewModel.readerItemId

    if (channelId == null || itemId == null) {
        LaunchedEffect(Unit) { viewModel.closeReader() }
        return
    }

    val detailState = viewModel.readerDetail
    val manifestState = viewModel.readerManifest

    Box(modifier = Modifier.fillMaxSize().background(Color(0xFF05060F))) {
        when {
            detailState is LoadState.Error || manifestState is LoadState.Error -> {
                BackHandler { viewModel.closeReader() }
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    com.afrovision.tv.ui.components.ConnectionErrorCard(
                        message = "Unable to open this title.",
                        onRetry = { viewModel.openReaderItem(channelId, itemId) }
                    )
                }
            }
            detailState is LoadState.Success && manifestState is LoadState.Success -> {
                ReaderContent(
                    viewModel = viewModel,
                    channelId = channelId,
                    itemId = itemId,
                    detail = detailState.data,
                    manifest = manifestState.data
                )
            }
            else -> {
                BackHandler { viewModel.closeReader() }
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = nocturne.gold)
                        Text(
                            text = "Opening…",
                            color = nocturne.textFaint,
                            fontSize = 18.sp,
                            modifier = Modifier.padding(top = 16.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ReaderContent(
    viewModel: TvViewModel,
    channelId: String,
    itemId: String,
    detail: com.afrovision.tv.data.api.model.LibraryItemDetail,
    manifest: ReaderManifest
) {
    val nocturne = LocalNocturne.current
    val context = LocalContext.current

    val pages = remember(manifest) { normalizePages(manifest) }
    val pagesByNumber = remember(pages) { pages.associateBy { it.pageNumber } }
    val spreads = remember(manifest, detail) {
        manifest.spreads?.takeIf { it.isNotEmpty() }
            ?: buildFallbackSpreads(detail.item.totalPages ?: pages.size)
    }
    val flat = remember(spreads) {
        spreads.flatMapIndexed { index, spread ->
            listOfNotNull(spread.leftPageNumber, spread.rightPageNumber).map { FlatPage(it, index) }
        }
    }
    val totalPages = flat.size.coerceAtLeast(1)

    var cursor by remember(itemId) {
        val saved = detail.progress?.currentSpreadIndex ?: 0
        mutableIntStateOf(flat.indexOfFirst { it.spreadIndex == saved }.coerceAtLeast(0))
    }
    var doublePage by remember { mutableStateOf(true) }
    var zoomIndex by remember(itemId) { mutableIntStateOf(0) }
    var panX by remember(itemId) { mutableStateOf(0f) }
    var panY by remember(itemId) { mutableStateOf(0f) }
    var controlsVisible by remember { mutableStateOf(true) }
    var bookmarksOpen by remember { mutableStateOf(false) }
    var finishedOpen by remember(itemId) { mutableStateOf(false) }
    var lastInteraction by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var turnDirection by remember { mutableIntStateOf(1) }

    val readingFocus = remember { FocusRequester() }
    val controlsFocus = remember { FocusRequester() }

    val current = flat.getOrNull(cursor.coerceIn(0, (flat.size - 1).coerceAtLeast(0)))
    val spreadIndex = current?.spreadIndex ?: 0
    val spread = spreads.getOrNull(spreadIndex)
    val zoom = ZOOM_LEVELS[zoomIndex]
    // Pages on screen right now.
    val visiblePages: List<Int> = when {
        current == null -> emptyList()
        doublePage -> listOfNotNull(spread?.leftPageNumber, spread?.rightPageNumber)
        else -> listOf(current.pageNumber)
    }
    val isLastPosition = if (doublePage) spreadIndex >= spreads.size - 1 else cursor >= flat.size - 1
    val bookmarkHere = viewModel.readerBookmarks.firstOrNull { it.spreadIndex == spreadIndex }

    fun focusReading() {
        try { readingFocus.requestFocus() } catch (_: IllegalStateException) { }
    }

    fun resetZoom() {
        zoomIndex = 0; panX = 0f; panY = 0f
    }

    fun saveProgress() {
        val s = spreads.getOrNull(spreadIndex) ?: return
        viewModel.saveReaderProgress(
            channelId, itemId,
            LibraryProgress(
                currentSpreadIndex = spreadIndex,
                currentPageLeft = s.leftPageNumber,
                currentPageRight = s.rightPageNumber,
                isCompleted = spreadIndex >= spreads.size - 1
            )
        )
    }

    fun goTo(newCursor: Int, direction: Int) {
        val target = newCursor.coerceIn(0, (flat.size - 1).coerceAtLeast(0))
        if (target == cursor) return
        turnDirection = direction
        cursor = target
        resetZoom()
        TvSoundManager.play("row")
    }

    fun next() {
        if (isLastPosition) {
            finishedOpen = true
            return
        }
        val target = if (doublePage) {
            flat.indexOfFirst { it.spreadIndex > spreadIndex }.takeIf { it >= 0 } ?: cursor
        } else cursor + 1
        goTo(target, 1)
    }

    fun prev() {
        val atStart = if (doublePage) spreadIndex == 0 else cursor == 0
        if (atStart) {
            detail.navigation.previousItemId?.let {
                TvSoundManager.play("screen")
                viewModel.openReaderItem(channelId, it)
            }
            return
        }
        val target = if (doublePage) {
            flat.indexOfFirst { it.spreadIndex == spreadIndex - 1 }.coerceAtLeast(0)
        } else cursor - 1
        goTo(target, -1)
    }

    fun showControls() {
        controlsVisible = true
        lastInteraction = System.currentTimeMillis()
    }

    // Autosave whenever the spread changes.
    LaunchedEffect(spreadIndex) { saveProgress() }

    // Preload the next two spreads' worth of pages (and one back), like the
    // website does, so turning a page doesn't wait on the network.
    LaunchedEffect(cursor) {
        val loader = context.imageLoader
        val from = (cursor - 2).coerceAtLeast(0)
        val to = (cursor + 5).coerceAtMost(flat.size - 1)
        for (i in from..to) {
            val url = pagesByNumber[flat[i].pageNumber]?.imageUrl?.takeIf { it.isNotBlank() } ?: continue
            val key = imageCacheKey(url)
            loader.enqueue(
                ImageRequest.Builder(context).data(url).apply {
                    if (key != null) { memoryCacheKey(key); diskCacheKey(key) }
                }.build()
            )
        }
    }

    // Controls hide themselves after a quiet spell, returning focus to the page.
    LaunchedEffect(controlsVisible, lastInteraction, bookmarksOpen, finishedOpen) {
        if (!controlsVisible || bookmarksOpen || finishedOpen) return@LaunchedEffect
        delay(CONTROLS_AUTO_HIDE_MS)
        controlsVisible = false
        focusReading()
    }

    LaunchedEffect(Unit) {
        withFrameNanos { }
        focusReading()
    }

    // Back peels one layer at a time.
    BackHandler {
        when {
            bookmarksOpen -> { bookmarksOpen = false; focusReading() }
            finishedOpen -> { finishedOpen = false; focusReading() }
            zoomIndex > 0 -> resetZoom()
            controlsVisible -> { controlsVisible = false; focusReading() }
            else -> viewModel.closeReader()
        }
    }

    // Page turn: the incoming spread swings in from the side it came from.
    val turn = remember { Animatable(0f) }
    val fade = remember { Animatable(1f) }
    LaunchedEffect(spreadIndex, cursor, doublePage) {
        turn.snapTo(if (doublePage) 55f * turnDirection else 0f)
        fade.snapTo(0.35f)
        launch { fade.animateTo(1f, tween(260)) }
        turn.animateTo(0f, tween(320))
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .onPreviewKeyEvent {
                if (it.type == KeyEventType.KeyDown) lastInteraction = System.currentTimeMillis()
                false
            }
    ) {
        // ── Reading area (the default focus target) ──
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .focusRequester(readingFocus)
                .onKeyEvent { event ->
                    if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                    val zoomed = zoomIndex > 0
                    when (event.nativeKeyEvent.keyCode) {
                        KeyEvent.KEYCODE_DPAD_RIGHT -> { if (zoomed) panX = (panX - PAN_STEP).coerceIn(-1f, 1f) else next(); true }
                        KeyEvent.KEYCODE_DPAD_LEFT -> { if (zoomed) panX = (panX + PAN_STEP).coerceIn(-1f, 1f) else prev(); true }
                        KeyEvent.KEYCODE_DPAD_UP -> {
                            if (zoomed) panY = (panY + PAN_STEP).coerceIn(-1f, 1f) else showControls()
                            true
                        }
                        KeyEvent.KEYCODE_DPAD_DOWN -> {
                            if (zoomed) {
                                panY = (panY - PAN_STEP).coerceIn(-1f, 1f)
                            } else {
                                showControls()
                                try { controlsFocus.requestFocus() } catch (_: IllegalStateException) { }
                            }
                            true
                        }
                        KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> {
                            zoomIndex = (zoomIndex + 1) % ZOOM_LEVELS.size
                            if (zoomIndex == 0) { panX = 0f; panY = 0f }
                            TvSoundManager.play("move")
                            true
                        }
                        KeyEvent.KEYCODE_MENU -> { showControls(); true }
                        KeyEvent.KEYCODE_PAGE_DOWN, KeyEvent.KEYCODE_MEDIA_FAST_FORWARD, KeyEvent.KEYCODE_CHANNEL_UP -> { next(); true }
                        KeyEvent.KEYCODE_PAGE_UP, KeyEvent.KEYCODE_MEDIA_REWIND, KeyEvent.KEYCODE_CHANNEL_DOWN -> { prev(); true }
                        else -> false
                    }
                }
                .focusable(),
            contentAlignment = Alignment.Center
        ) {
            // Fill the height; shrink only if the spread is wider than the screen.
            val maxH = maxHeight - 32.dp
            val maxW = maxWidth - 48.dp
            val pageCount = visiblePages.size.coerceAtLeast(1)
            val naturalW = maxH * PAGE_ASPECT * pageCount
            val fit = if (naturalW > maxW) maxW / naturalW else 1f
            val pageW = maxH * PAGE_ASPECT * fit
            val pageH = maxH * fit
            // How far a zoomed page may move before its edge would come into view.
            val maxPanX = (pageW * pageCount * (zoom - 1f)) / 2f
            val maxPanY = (pageH * (zoom - 1f)) / 2f

            Row(
                modifier = Modifier
                    .graphicsLayer {
                        scaleX = zoom
                        scaleY = zoom
                        translationX = (maxPanX * panX).toPx()
                        translationY = (maxPanY * panY).toPx()
                        rotationY = turn.value
                        cameraDistance = 28f * density
                        alpha = fade.value
                    }
                    .clip(RoundedCornerShape(6.dp))
            ) {
                visiblePages.forEachIndexed { index, pageNumber ->
                    Box(
                        modifier = Modifier
                            .size(width = pageW, height = pageH)
                            .background(Color(0xFFFFFBF3))
                    ) {
                        ReaderPageSlot(page = pagesByNumber[pageNumber], pageNum = pageNumber)
                        // Gutter shading where the two pages meet.
                        if (pageCount == 2) {
                            Box(
                                modifier = Modifier
                                    .align(if (index == 0) Alignment.CenterEnd else Alignment.CenterStart)
                                    .fillMaxHeight()
                                    .width(18.dp)
                                    .background(
                                        Brush.horizontalGradient(
                                            if (index == 0) listOf(Color.Transparent, Color.Black.copy(alpha = 0.18f))
                                            else listOf(Color.Black.copy(alpha = 0.18f), Color.Transparent)
                                        )
                                    )
                            )
                        }
                    }
                }
            }
        }

        // Quiet page counter while the controls are hidden.
        if (!controlsVisible && !bookmarksOpen && !finishedOpen) {
            Text(
                text = pageLabel(visiblePages, totalPages) + if (zoomIndex > 0) "  ·  ${(zoom * 100).toInt()}%" else "",
                color = Color.White.copy(alpha = 0.55f),
                fontSize = 15.sp,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 28.dp, bottom = 14.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color.Black.copy(alpha = 0.45f))
                    .padding(horizontal = 12.dp, vertical = 5.dp)
            )
        }

        // ── Top bar ──
        if (controlsVisible && !finishedOpen) {
            Row(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.85f), Color.Transparent)))
                    .padding(horizontal = 48.dp, vertical = 24.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(18.dp)
            ) {
                Text(
                    text = detail.item.title,
                    color = Color.White,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (bookmarkHere != null) {
                    Text(text = "★ Bookmarked", color = nocturne.goldLight, fontSize = 16.sp)
                }
                Text(text = pageLabel(visiblePages, totalPages), color = Color.White.copy(alpha = 0.75f), fontSize = 18.sp)
            }
        }

        // ── Bottom controls ──
        if (controlsVisible && !finishedOpen) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.9f))))
                    .padding(start = 48.dp, end = 48.dp, top = 40.dp, bottom = 26.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                PageSlider(
                    position = cursor,
                    count = flat.size,
                    onStep = { delta ->
                        val step = (flat.size / 10).coerceAtLeast(1) * delta
                        goTo(cursor + step, if (delta > 0) 1 else -1)
                    }
                )
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    ReaderControl(label = "‹ Previous", onClick = { prev() })
                    ReaderControl(label = if (isLastPosition) "Finish ✓" else "Next ›", onClick = { next() }, focusRequester = controlsFocus)
                    ReaderControl(label = "Zoom −", enabled = zoomIndex > 0, onClick = {
                        zoomIndex = (zoomIndex - 1).coerceAtLeast(0)
                        if (zoomIndex == 0) { panX = 0f; panY = 0f }
                    })
                    ReaderControl(label = "Zoom +", enabled = zoomIndex < ZOOM_LEVELS.size - 1, onClick = {
                        zoomIndex = (zoomIndex + 1).coerceAtMost(ZOOM_LEVELS.size - 1)
                    })
                    ReaderControl(label = if (doublePage) "Single page" else "Two pages", onClick = {
                        doublePage = !doublePage
                        resetZoom()
                    })
                    ReaderControl(
                        label = if (bookmarkHere != null) "★ Remove bookmark" else "☆ Bookmark",
                        onClick = {
                            if (bookmarkHere != null) {
                                viewModel.deleteReaderBookmark(channelId, itemId, bookmarkHere.id)
                            } else {
                                viewModel.addReaderBookmark(channelId, itemId, spreadIndex, visiblePages.firstOrNull())
                            }
                        }
                    )
                    ReaderControl(label = "Bookmarks (${viewModel.readerBookmarks.size})", onClick = { bookmarksOpen = true })
                    Spacer(modifier = Modifier.weight(1f))
                    Text(
                        text = "OK zoom  ·  ◀ ▶ turn  ·  BACK close",
                        color = Color.White.copy(alpha = 0.45f),
                        fontSize = 14.sp
                    )
                }
            }
        }

        // ── Bookmarks panel ──
        if (bookmarksOpen) {
            BookmarksPanel(
                bookmarks = viewModel.readerBookmarks,
                pageLabelFor = { bm -> bm.page?.let { "Page $it" } ?: "Spread ${bm.spreadIndex + 1}" },
                onOpen = { bm ->
                    val target = flat.indexOfFirst { it.spreadIndex == bm.spreadIndex }
                    if (target >= 0) goTo(target, if (target > cursor) 1 else -1)
                    bookmarksOpen = false
                    focusReading()
                },
                onDelete = { bm -> viewModel.deleteReaderBookmark(channelId, itemId, bm.id) },
                onClose = { bookmarksOpen = false; focusReading() },
                modifier = Modifier.align(Alignment.CenterEnd)
            )
        }

        // ── Finished ──
        if (finishedOpen) {
            val more = remember(channelId, itemId, viewModel.library, viewModel.exclusiveLibrary) {
                val all = ((viewModel.library as? LoadState.Success)?.data.orEmpty() +
                    (viewModel.exclusiveLibrary as? LoadState.Success)?.data.orEmpty())
                all.filter { it.channelId == channelId && it.id != itemId }.distinctBy { it.id }.take(8)
            }
            FinishedSheet(
                title = detail.item.title,
                hasNext = detail.navigation.nextItemId != null,
                more = more,
                onNext = {
                    detail.navigation.nextItemId?.let {
                        TvSoundManager.play("screen")
                        viewModel.openReaderItem(channelId, it)
                    }
                },
                onReadAgain = {
                    finishedOpen = false
                    goTo(0, -1)
                    focusReading()
                },
                onOpenItem = { other -> viewModel.openReaderItem(other.channelId, other.id) },
                onClose = { viewModel.closeReader() }
            )
        }
    }
}

private fun pageLabel(visiblePages: List<Int>, total: Int): String = when (visiblePages.size) {
    0 -> ""
    1 -> "Page ${visiblePages[0]} of $total"
    else -> "Pages ${visiblePages.first()}–${visiblePages.last()} of $total"
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
            Text(text = "Page $pageNum", color = Color(0xFF9A8A7A), fontSize = 16.sp)
        }
    }
}

/** A focusable control with a clear gold focus ring. */
@Composable
private fun ReaderControl(
    label: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    focusRequester: FocusRequester? = null
) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Box(
        modifier = Modifier
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .clip(RoundedCornerShape(10.dp))
            .background(if (focused) nocturne.gold.copy(alpha = 0.2f) else Color.White.copy(alpha = 0.08f))
            .border(if (focused) 2.dp else 1.dp, if (focused) nocturne.gold else Color.White.copy(alpha = 0.16f), RoundedCornerShape(10.dp))
            .clickable(interactionSource = interactionSource, indication = null, enabled = enabled, onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 11.dp)
    ) {
        Text(
            text = label,
            color = when {
                !enabled -> Color.White.copy(alpha = 0.3f)
                focused -> nocturne.goldLight
                else -> Color.White.copy(alpha = 0.9f)
            },
            fontSize = 17.sp,
            fontWeight = if (focused) FontWeight.SemiBold else FontWeight.Normal
        )
    }
}

/** Focusable progress bar: Left/Right jump about a tenth of the title. */
@Composable
private fun PageSlider(position: Int, count: Int, onStep: (Int) -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    val fraction = if (count <= 1) 1f else position.toFloat() / (count - 1)
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Box(
            modifier = Modifier
                .weight(1f)
                .height(if (focused) 10.dp else 6.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(Color.White.copy(alpha = 0.16f))
                .border(if (focused) 2.dp else 0.dp, nocturne.gold, RoundedCornerShape(5.dp))
                .onKeyEvent { event ->
                    if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                    when (event.nativeKeyEvent.keyCode) {
                        KeyEvent.KEYCODE_DPAD_RIGHT -> { onStep(1); true }
                        KeyEvent.KEYCODE_DPAD_LEFT -> { onStep(-1); true }
                        else -> false
                    }
                }
                .focusable(interactionSource = interactionSource)
        ) {
            Box(modifier = Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).fillMaxHeight().background(nocturne.gold))
        }
        Text(
            text = if (focused) "◀ ▶ jump" else "${position + 1} / $count",
            color = if (focused) nocturne.goldLight else Color.White.copy(alpha = 0.7f),
            fontSize = 15.sp
        )
    }
}

@Composable
private fun BookmarksPanel(
    bookmarks: List<com.afrovision.tv.data.api.model.LibraryBookmark>,
    pageLabelFor: (com.afrovision.tv.data.api.model.LibraryBookmark) -> String,
    onOpen: (com.afrovision.tv.data.api.model.LibraryBookmark) -> Unit,
    onDelete: (com.afrovision.tv.data.api.model.LibraryBookmark) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    val nocturne = LocalNocturne.current
    val firstFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        withFrameNanos { }
        try { firstFocus.requestFocus() } catch (_: IllegalStateException) { }
    }
    Column(
        modifier = modifier
            .fillMaxHeight()
            .width(440.dp)
            .background(Color(0xF20B1030))
            .border(1.dp, Color.White.copy(alpha = 0.08f))
            .padding(28.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(text = "Bookmarks", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.SemiBold)
        Text(
            text = "Saved to your account - the same bookmarks as the website.",
            color = Color.White.copy(alpha = 0.55f),
            fontSize = 14.sp,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        if (bookmarks.isEmpty()) {
            Text(
                text = "No bookmarks yet. Use ☆ Bookmark in the controls to add one.",
                color = Color.White.copy(alpha = 0.6f),
                fontSize = 16.sp
            )
            ReaderControl(label = "Close", onClick = onClose, focusRequester = firstFocus)
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.weight(1f)) {
                itemsIndexed(bookmarks, key = { _, bm -> bm.id }) { index, bm ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(modifier = Modifier.weight(1f)) {
                            ReaderControl(
                                label = "★  " + pageLabelFor(bm),
                                onClick = { onOpen(bm) },
                                focusRequester = if (index == 0) firstFocus else null
                            )
                        }
                        ReaderControl(label = "Delete", onClick = { onDelete(bm) })
                    }
                }
            }
            ReaderControl(label = "Close", onClick = onClose)
        }
    }
}

@Composable
private fun FinishedSheet(
    title: String,
    hasNext: Boolean,
    more: List<LibraryFeedItem>,
    onNext: () -> Unit,
    onReadAgain: () -> Unit,
    onOpenItem: (LibraryFeedItem) -> Unit,
    onClose: () -> Unit
) {
    val nocturne = LocalNocturne.current
    val firstFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        withFrameNanos { }
        try { firstFocus.requestFocus() } catch (_: IllegalStateException) { }
    }
    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xE6050614)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp),
            modifier = Modifier.padding(horizontal = 80.dp)
        ) {
            Text(text = "FINISHED", color = nocturne.goldLight, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.sp)
            Text(
                text = title,
                color = Color.White,
                fontSize = 34.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center
            )
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(top = 6.dp)) {
                if (hasNext) ReaderControl(label = "Next chapter ›", onClick = onNext, focusRequester = firstFocus)
                ReaderControl(label = "Read again", onClick = onReadAgain, focusRequester = if (hasNext) null else firstFocus)
                ReaderControl(label = "Back to library", onClick = onClose)
            }
            if (more.isNotEmpty()) {
                Text(
                    text = "More from this channel",
                    color = Color.White.copy(alpha = 0.8f),
                    fontSize = 20.sp,
                    modifier = Modifier.padding(top = 18.dp)
                )
                LazyRow(horizontalArrangement = Arrangement.spacedBy(18.dp), contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp)) {
                    items(more, key = { it.id }) { item -> MiniCover(item = item, onClick = { onOpenItem(item) }) }
                }
            }
        }
    }
}

@Composable
private fun MiniCover(item: LibraryFeedItem, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Column(modifier = Modifier.width(130.dp)) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .clip(RoundedCornerShape(8.dp))
                .background(nocturne.surfaceRaised)
                .border(if (focused) 3.dp else 1.dp, if (focused) nocturne.gold else Color.White.copy(alpha = 0.1f), RoundedCornerShape(8.dp))
                .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
        ) {
            rememberCacheableImageRequest(item.coverAssetUrl)?.let {
                AsyncImage(model = it, contentDescription = item.title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            }
        }
        Text(
            text = item.title,
            color = if (focused) nocturne.goldLight else Color.White.copy(alpha = 0.85f),
            fontSize = 13.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 6.dp)
        )
    }
}
