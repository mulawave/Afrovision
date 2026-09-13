package com.afrovision.tv.ui.screens

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.data.LoadState
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.api.model.Message
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne

private val messageFolders = listOf("Inbox", "Chat", "Drafts", "Sent", "Archive")

@Composable
fun MessagesScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val messages = viewModel.messages
    var selectedFolder by remember { mutableStateOf("Inbox") }

    LaunchedEffect(Unit) { if (messages !is LoadState.Success) viewModel.loadMessages() }

    val items = when (messages) {
        is LoadState.Success -> messages.data
        else -> emptyList()
    }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val selected = items.firstOrNull { it.id == selectedId } ?: items.firstOrNull()

    LaunchedEffect(selected?.id, selected?.read) {
        val current = selected
        if (current != null && !current.read) {
            TvSoundManager.play("read")
            viewModel.markMessagesRead(listOf(current.id))
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(nocturne.primaryGradient)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Column(modifier = Modifier.padding(start = 60.dp, end = 60.dp, top = 60.dp)) {
                Text(text = "Messages", color = nocturne.text, fontSize = 52.sp)
                Text(
                    text = "${items.count { !it.read }} unread · ${items.size} messages",
                    color = nocturne.textHint,
                    fontSize = 20.sp,
                    modifier = Modifier.padding(top = 6.dp)
                )
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(top = 26.dp, bottom = 20.dp)) {
                    messageFolders.forEach { folder ->
                        MessageFolderChip(label = folder, selected = folder == selectedFolder, onClick = { selectedFolder = folder })
                    }
                }
            }

            if (selectedFolder == "Chat") {
                ChatFolderContent(viewModel = viewModel, modifier = Modifier.fillMaxSize())
            } else {
                Row(modifier = Modifier.fillMaxSize()) {
                    if (items.isEmpty()) {
                        Box(modifier = Modifier.fillMaxSize().padding(60.dp), contentAlignment = Alignment.Center) {
                            Text(text = "No messages", color = nocturne.textFaint, fontSize = 22.sp)
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.width(660.dp).fillMaxHeight(),
                            contentPadding = PaddingValues(start = 60.dp, end = 24.dp, bottom = 60.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(items, key = { it.id }) { msg ->
                                MessageListRow(
                                    message = msg,
                                    isSelected = msg.id == selected?.id,
                                    onClick = { selectedId = msg.id }
                                )
                            }
                        }

                        if (selected != null) {
                            MessageReader(message = selected, viewModel = viewModel, modifier = Modifier.weight(1f).fillMaxHeight())
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageFolderChip(label: String, selected: Boolean, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (selected) nocturne.accent900 else Color.Transparent)
            .border(
                BorderStroke(if (focused) 2.dp else 1.dp, if (focused) nocturne.gold else if (selected) nocturne.accent700 else nocturne.borderCard),
                RoundedCornerShape(999.dp)
            )
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 10.dp)
    ) {
        Text(text = label, color = if (focused) nocturne.goldLight else if (selected) nocturne.accentLight else nocturne.textMuted, fontSize = 17.sp)
    }
}

@Composable
private fun MessageListRow(message: Message, isSelected: Boolean, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    val tint = when (message.type) {
        "critical" -> nocturne.accent
        "program_update" -> nocturne.gold
        "psa" -> nocturne.textMuted
        else -> nocturne.text
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .border(
                if (focused || isSelected) 2.dp else 1.dp,
                if (focused || isSelected) nocturne.accent else nocturne.borderCard,
                RoundedCornerShape(10.dp)
            )
            .background(if (isSelected) nocturne.surfaceRaised else nocturne.surface)
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(modifier = Modifier.size(8.dp).clip(RoundedCornerShape(50)).background(tint))
            Text(text = message.title, color = nocturne.text, fontSize = 19.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Text(text = message.createdAt ?: "", color = nocturne.textFaint, fontSize = 14.sp)
        }
        Text(text = message.body, color = nocturne.textHint, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun MessageReader(message: Message, viewModel: TvViewModel, modifier: Modifier = Modifier) {
    val nocturne = LocalNocturne.current
    var draft by remember(message.id) { mutableStateOf("") }
    var sent by remember(message.id) { mutableStateOf(false) }

    Column(
        modifier = modifier.padding(start = 40.dp, end = 60.dp, bottom = 60.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(text = message.title, color = nocturne.text, fontSize = 30.sp, fontWeight = FontWeight.Medium)
        Text(text = message.createdAt ?: "", color = nocturne.textFaint, fontSize = 17.sp)
        Text(text = message.body, color = nocturne.text, fontSize = 20.sp, lineHeight = 30.sp)
        Spacer(modifier = Modifier.height(8.dp))

        if (message.allowReply) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(nocturne.radiusMd.dp))
                    .border(1.dp, nocturne.borderCard, RoundedCornerShape(nocturne.radiusMd.dp))
                    .padding(20.dp)
            ) {
                Text(text = "Reply", color = nocturne.textHint, fontSize = 16.sp)
                Box(modifier = Modifier.padding(top = 8.dp)) {
                    if (draft.isEmpty()) {
                        Text(text = "Type a reply…", color = nocturne.textFaint, fontSize = 20.sp)
                    }
                    BasicTextField(
                        value = draft,
                        onValueChange = { draft = it },
                        textStyle = TextStyle(color = nocturne.text, fontSize = 20.sp),
                        cursorBrush = SolidColor(nocturne.accent),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(onSend = {
                            if (draft.isNotBlank()) {
                                TvSoundManager.play("send")
                                viewModel.replyToMessage(message.id, draft)
                                sent = true
                                draft = ""
                            }
                        }),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                ReaderButton(label = "Send reply") {
                    if (draft.isNotBlank()) {
                        TvSoundManager.play("send")
                        viewModel.replyToMessage(message.id, draft)
                        sent = true
                        draft = ""
                    }
                }
            }
            if (sent) {
                Text(text = "Reply sent", color = nocturne.accentLight, fontSize = 16.sp)
            }
        } else {
            Text(text = "This message does not accept replies.", color = nocturne.textFaint, fontSize = 16.sp)
        }
    }
}

// ── TV-to-TV chat (real backend: /distribution/tv/chat/*) ─────────

@Composable
private fun ChatFolderContent(viewModel: TvViewModel, modifier: Modifier = Modifier) {
    val nocturne = LocalNocturne.current
    val connections = viewModel.chatConnections
    var openConnectionId by remember { mutableStateOf<String?>(null) }
    var showConnect by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.loadChatPin()
        viewModel.loadChatConnections()
    }

    val list = when (connections) {
        is LoadState.Success -> connections.data
        else -> emptyList()
    }
    val open = list.firstOrNull { it.id == openConnectionId }

    Row(modifier = modifier) {
        Column(
            modifier = Modifier.width(660.dp).fillMaxHeight(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            ChatPinCard(
                pin = viewModel.chatPin,
                onRegenerate = { viewModel.regenerateChatPin() },
                onConnect = { showConnect = !showConnect }
            )

            if (showConnect) {
                ChatConnectField(
                    error = viewModel.chatConnectError,
                    onSubmit = { pin -> viewModel.connectByChatPin(pin) }
                )
            }

            if (list.isEmpty()) {
                Text(
                    text = "No connections yet. Share your AfroVision PIN with someone, or enter theirs above.",
                    color = nocturne.textFaint,
                    fontSize = 16.sp,
                    modifier = Modifier.padding(horizontal = 60.dp)
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(start = 60.dp, end = 24.dp, bottom = 60.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(list, key = { it.id }) { connection ->
                        ChatConnectionRow(
                            connection = connection,
                            isSelected = connection.id == openConnectionId,
                            onOpen = {
                                openConnectionId = connection.id
                                if (connection.status == "accepted") viewModel.openChatConnection(connection.id)
                            },
                            onAccept = { viewModel.respondToChatConnection(connection.id, true) },
                            onDecline = { viewModel.respondToChatConnection(connection.id, false) }
                        )
                    }
                }
            }
        }

        if (open != null && open.status == "accepted") {
            ChatConversation(
                connection = open,
                viewModel = viewModel,
                modifier = Modifier.weight(1f).fillMaxHeight()
            )
        }
    }
}

@Composable
private fun ChatPinCard(pin: String?, onRegenerate: () -> Unit, onConnect: () -> Unit) {
    val nocturne = LocalNocturne.current
    Column(
        modifier = Modifier
            .padding(start = 60.dp, end = 24.dp, top = 4.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(nocturne.radiusMd.dp))
            .border(1.dp, nocturne.borderCard, RoundedCornerShape(nocturne.radiusMd.dp))
            .background(nocturne.surface)
            .padding(20.dp)
    ) {
        Text(text = "Your AfroVision PIN", color = nocturne.textHint, fontSize = 15.sp)
        Text(
            text = pin?.let { it.chunked(3).joinToString(" ") } ?: "……",
            color = nocturne.accentLight,
            fontSize = 34.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(top = 6.dp)
        )
        Text(
            text = "Share this with someone so they can connect and chat with you.",
            color = nocturne.textFaint,
            fontSize = 14.sp,
            modifier = Modifier.padding(top = 4.dp)
        )
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 14.dp)) {
            ReaderButton(label = "Connect with a PIN", onClick = onConnect)
            ReaderButton(label = "New PIN", onClick = onRegenerate)
        }
    }
}

@Composable
private fun ChatConnectField(error: String?, onSubmit: (String) -> Unit) {
    val nocturne = LocalNocturne.current
    var pinDraft by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .padding(start = 60.dp, end = 24.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(nocturne.radiusMd.dp))
            .border(1.dp, nocturne.borderCard, RoundedCornerShape(nocturne.radiusMd.dp))
            .padding(20.dp)
    ) {
        Text(text = "Enter their AfroVision PIN", color = nocturne.textHint, fontSize = 15.sp)
        Box(modifier = Modifier.padding(top = 8.dp)) {
            if (pinDraft.isEmpty()) {
                Text(text = "123456", color = nocturne.textFaint, fontSize = 26.sp)
            }
            BasicTextField(
                value = pinDraft,
                onValueChange = { new -> if (new.length <= 6 && new.all { it.isDigit() }) pinDraft = new },
                textStyle = TextStyle(color = nocturne.text, fontSize = 26.sp, letterSpacing = 4.sp),
                cursorBrush = SolidColor(nocturne.accent),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = {
                    if (pinDraft.length == 6) onSubmit(pinDraft)
                }),
                modifier = Modifier.fillMaxWidth()
            )
        }
        if (!error.isNullOrBlank()) {
            Text(text = error, color = Color(0xFFFF6B6B), fontSize = 14.sp, modifier = Modifier.padding(top = 8.dp))
        }
        Row(modifier = Modifier.padding(top = 12.dp)) {
            ReaderButton(label = "Send request") { if (pinDraft.length == 6) onSubmit(pinDraft) }
        }
    }
}

@Composable
private fun ChatConnectionRow(
    connection: com.afrovision.tv.data.api.model.ChatConnection,
    isSelected: Boolean,
    onOpen: () -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    val name = connection.otherUser?.name ?: "AfroVision user"
    val pendingIncoming = connection.status == "pending" && !connection.requestedByMe

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .border(
                if (focused || isSelected) 2.dp else 1.dp,
                if (focused || isSelected) nocturne.accent else nocturne.borderCard,
                RoundedCornerShape(10.dp)
            )
            .background(if (isSelected) nocturne.surfaceRaised else nocturne.surface)
            .clickable(interactionSource = interactionSource, indication = null, onClick = onOpen)
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(50))
                    .background(nocturne.accent900),
                contentAlignment = Alignment.Center
            ) {
                Text(text = name.take(1).uppercase(), color = nocturne.accentLight, fontSize = 15.sp)
            }
            Text(text = name, color = nocturne.text, fontSize = 19.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            if (connection.unreadCount > 0) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(nocturne.accent)
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = if (connection.unreadCount > 9) "9+" else connection.unreadCount.toString(),
                        color = Color.Black,
                        fontSize = 13.sp
                    )
                }
            }
            Text(
                text = when (connection.status) {
                    "pending" -> if (pendingIncoming) "Wants to connect" else "Request sent"
                    "accepted" -> "Connected"
                    "blocked" -> "Blocked"
                    else -> connection.status
                },
                color = if (connection.status == "accepted") nocturne.accentLight else nocturne.textFaint,
                fontSize = 14.sp
            )
        }
        if (pendingIncoming) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ReaderButton(label = "Accept", onClick = onAccept)
                ReaderButton(label = "Decline", onClick = onDecline)
            }
        }
    }
}

@Composable
private fun ChatConversation(
    connection: com.afrovision.tv.data.api.model.ChatConnection,
    viewModel: TvViewModel,
    modifier: Modifier = Modifier
) {
    val nocturne = LocalNocturne.current
    val messagesState = viewModel.chatMessages
    var draft by remember(connection.id) { mutableStateOf("") }
    val otherId = connection.otherUser?.id

    val messages = when (messagesState) {
        is LoadState.Success -> messagesState.data
        else -> emptyList()
    }

    Column(modifier = modifier.padding(start = 40.dp, end = 60.dp, bottom = 60.dp)) {
        Text(text = connection.otherUser?.name ?: "Chat", color = nocturne.text, fontSize = 26.sp, fontWeight = FontWeight.Medium)

        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth().padding(top = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(messages, key = { it.id }) { msg ->
                val fromMe = msg.senderId != otherId
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = if (fromMe) Arrangement.End else Arrangement.Start
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (fromMe) nocturne.accent900 else nocturne.surface)
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                    ) {
                        Text(text = msg.body, color = nocturne.text, fontSize = 18.sp)
                    }
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 12.dp)
                .clip(RoundedCornerShape(nocturne.radiusMd.dp))
                .border(1.dp, nocturne.borderCard, RoundedCornerShape(nocturne.radiusMd.dp))
                .padding(horizontal = 20.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(modifier = Modifier.weight(1f)) {
                if (draft.isEmpty()) {
                    Text(text = "Message…", color = nocturne.textFaint, fontSize = 19.sp)
                }
                BasicTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    textStyle = TextStyle(color = nocturne.text, fontSize = 19.sp),
                    cursorBrush = SolidColor(nocturne.accent),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = {
                        if (draft.isNotBlank()) {
                            TvSoundManager.play("send")
                            viewModel.sendChatMessage(connection.id, draft)
                            draft = ""
                        }
                    }),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun ReaderButton(label: String, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (focused) nocturne.accent900 else Color.Transparent)
            .border(if (focused) 2.dp else 1.dp, if (focused) nocturne.accent else nocturne.borderCard, RoundedCornerShape(10.dp))
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = 22.dp, vertical = 14.dp)
    ) {
        Text(text = label, color = if (focused) nocturne.accentLight else nocturne.textMuted, fontSize = 18.sp)
    }
}
