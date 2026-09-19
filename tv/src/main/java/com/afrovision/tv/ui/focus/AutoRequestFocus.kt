package com.afrovision.tv.ui.focus

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester

/**
 * Attaches [focusRequester] and pulls focus to this element once it is
 * composed, so a newly shown overlay lands on its default action without the
 * viewer having to D-pad to it.
 *
 * requestFocus() throws if the node is not attached yet (or was detached
 * between composition and the effect running), which on TV would crash the
 * whole overlay — a focus convenience must never do that.
 */
fun Modifier.autoRequestFocus(
    focusRequester: FocusRequester,
    enabled: Boolean = true
): Modifier = composed {
    LaunchedEffect(enabled) {
        if (enabled) {
            runCatching { focusRequester.requestFocus() }
        }
    }
    focusRequester(focusRequester)
}
