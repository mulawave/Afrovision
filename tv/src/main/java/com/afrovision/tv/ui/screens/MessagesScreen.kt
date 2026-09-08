package com.afrovision.tv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.api.model.Message
import com.afrovision.tv.ui.components.TopChrome
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun MessagesScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val messages = viewModel.messages
    val userName = viewModel.userName.collectAsState("").value

    LaunchedEffect(Unit) { if (messages is LoadState.Loading) viewModel.loadMessages() }

    val items = when (messages) {
        is LoadState.Success -> messages.data
        else -> emptyList()
    }

    Box(modifier = Modifier.fillMaxSize().background(nocturne.background)) {
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    0f to nocturne.accent900.copy(alpha = 0.3f),
                    0.5f to nocturne.background,
                    1f to nocturne.background
                )
            )
        )
        Column(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.fillMaxWidth().height(64.dp), contentAlignment = Alignment.CenterEnd) {
                TopChrome(userName = userName, userAvatar = userName, modifier = Modifier.fillMaxSize())
            }
            LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(60.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                item {
                    Text(text = "Messages", color = nocturne.text, fontSize = 42.sp, modifier = Modifier.padding(bottom = 24.dp))
                }
                if (items.isNotEmpty()) {
                    items(items, key = { it.id }) { msg ->
                        MessageCard(message = msg, viewModel = viewModel)
                    }
                } else {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().height(240.dp), contentAlignment = Alignment.Center) {
                            Text(text = "No messages", color = nocturne.textFaint, fontSize = 22.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageCard(message: Message, viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    var focused by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }
    val tint = when (message.type) {
        "critical" -> nocturne.accent
        "program_update" -> nocturne.gold
        "psa" -> nocturne.textMuted
        else -> nocturne.text
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(
                2.dp,
                if (focused) nocturne.accent else nocturne.borderCard,
                RoundedCornerShape(12.dp)
            )
            .background(nocturne.surface)
            .focusRequester(focusRequester)
            .focusable(true)
            .onFocusChanged { focused = it.isFocused }
            .clickable { viewModel.replyToMessage(message.id, "Acknowledged") }
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(
                modifier = Modifier
                    .size(16.dp)
                    .clip(RoundedCornerShape(50))
                    .background(tint)
            )
            Text(text = message.type.uppercase(), color = tint, fontSize = 15.sp, fontWeight = FontWeight.Medium)
            Spacer(modifier = Modifier.weight(1f))
            Text(text = message.createdAt ?: "", color = nocturne.textFaint, fontSize = 15.sp)
        }
        Text(text = message.title, color = nocturne.text, fontSize = 22.sp, fontWeight = FontWeight.Medium)
        Text(
            text = message.body,
            color = nocturne.text,
            fontSize = 18.sp,
            lineHeight = 26.sp,
            maxLines = 4,
            overflow = TextOverflow.Ellipsis
        )
    }
}
