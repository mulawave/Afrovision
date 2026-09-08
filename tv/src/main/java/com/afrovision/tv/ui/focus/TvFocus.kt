package com.afrovision.tv.ui.focus

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.focusable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged

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
            .focusable(true)
            .focusGroup()
            .onFocusChanged {
                if (it.isFocused) onFocus()
                else if (!it.isFocused && !it.hasFocus) onFocusLost()
            },
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
    .focusable(true)
    .onFocusChanged { if (it.isFocused) onFocused() }
