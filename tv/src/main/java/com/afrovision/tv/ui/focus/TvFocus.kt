package com.afrovision.tv.ui.focus

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.focusable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.layout.onGloballyPositioned

/**
 * Requests focus for [focusRequester] as soon as this node is actually
 * placed, instead of immediately in a LaunchedEffect(Unit) (the common
 * pattern elsewhere in this app). Requesting focus before Compose finishes
 * the first layout/placement pass races the framework's own "scroll the
 * newly-focused item into view" coroutine (used by any scrollable/lazy
 * ancestor) against that placement, and throws
 * IllegalStateException("Expected BringIntoViewRequester to not be used
 * before parents are placed.") asynchronously from a different coroutine -
 * which no try/catch around requestFocus() itself can catch - crashing the
 * app. Gating on onGloballyPositioned guarantees placement has already
 * happened before we ask for focus.
 */
fun Modifier.autoRequestFocus(
    focusRequester: FocusRequester,
    enabled: Boolean = true
): Modifier = composed {
    var placed by remember { mutableStateOf(false) }
    LaunchedEffect(placed, enabled) {
        if (placed && enabled) {
            // Placement alone isn't enough when this node's ancestor chain
            // crosses an AnimatedContent transition (e.g. splash fading into
            // this screen): onGloballyPositioned already fires mid-transition,
            // while an ancestor's own scroll-into-view bookkeeping is still
            // mid-animation. A short buffer past typical transition length
            // avoids racing that and throwing IllegalStateException(
            // "Expected BringIntoViewRequester to not be used before parents
            // are placed.").
            kotlinx.coroutines.delay(350)
            try {
                focusRequester.requestFocus()
            } catch (_: IllegalStateException) {
            }
        }
    }
    this
        .focusRequester(focusRequester)
        .onGloballyPositioned { if (!placed) placed = true }
}

@Composable
fun TvFocusGroup(
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester = remember { FocusRequester() },
    onFocus: () -> Unit = {},
    onFocusLost: () -> Unit = {},
    content: @Composable () -> Unit
) {
    Box(
        modifier = modifier
            .focusRequester(focusRequester)
            .onFocusChanged {
                if (it.isFocused) onFocus()
                else if (!it.isFocused && !it.hasFocus) onFocusLost()
            }
            .focusable(true)
            .focusGroup(),
        contentAlignment = Alignment.Center
    ) {
        content()
    }
}

fun Modifier.dpadFocus(
    focusRequester: FocusRequester = FocusRequester(),
    onFocused: () -> Unit = {}
): Modifier = this
    .focusRequester(focusRequester)
    .onFocusChanged { if (it.isFocused) onFocused() }
    .focusable(true)
