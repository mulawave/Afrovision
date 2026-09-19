package com.afrovision.tv.ui.screens

import com.afrovision.tv.ui.components.rememberCacheableImageRequest

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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.afrovision.tv.R
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.ui.navigation.Screen
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne

private const val POSTS_PER_PAGE = 5

@Composable
fun ProfileScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val profile = viewModel.profile
    val userName = viewModel.userName.collectAsState("").value
    var page by remember(profile.posts.size) { mutableStateOf(0) }
    val exclusiveAccess = viewModel.exclusiveAccess
    val exclusiveChannelCount = (exclusiveAccess as? com.afrovision.tv.data.LoadState.Success)?.data?.accesses?.size ?: 0

    LaunchedEffect(Unit) {
        viewModel.loadProfile()
        viewModel.loadExclusiveAccess()
    }

    Box(modifier = Modifier.fillMaxSize().background(nocturne.primaryGradient)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 60.dp, end = 60.dp, top = 60.dp, bottom = 60.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(32.dp)) {
                    Box(
                        modifier = Modifier
                            .size(150.dp)
                            .clip(RoundedCornerShape(75.dp))
                            .background(nocturne.accent900)
                            .border(2.dp, nocturne.accent700, RoundedCornerShape(75.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        if (profile.avatar.isNotBlank()) {
                            AsyncImage(model = rememberCacheableImageRequest(profile.avatar), contentDescription = null, modifier = Modifier.fillMaxWidth().height(150.dp))
                        } else {
                            Text(text = initials(profile.name), color = nocturne.accentLight, fontSize = 48.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(text = profile.name.ifBlank { userName }, color = nocturne.text, fontSize = 46.sp, fontWeight = FontWeight.Medium)
                        Text(text = "@${(profile.name.ifBlank { userName }).lowercase().replace(" ", "")}", color = nocturne.textHint, fontSize = 19.sp)
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(nocturne.accent900)
                                    .border(1.dp, nocturne.accent700, RoundedCornerShape(999.dp))
                                    .padding(horizontal = 14.dp, vertical = 6.dp)
                            ) {
                                Text(text = formatTier(profile.tier, profile.isPremiumCreator), color = nocturne.accentLight, fontSize = 14.sp)
                            }
                            if (exclusiveChannelCount > 0) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(999.dp))
                                        .background(nocturne.background.copy(alpha = 0.5f))
                                        .border(1.dp, nocturne.gold, RoundedCornerShape(999.dp))
                                        .padding(horizontal = 14.dp, vertical = 6.dp)
                                ) {
                                    Text(
                                        text = "EXCLUSIVE MEMBER · $exclusiveChannelCount CHANNEL${if (exclusiveChannelCount == 1) "" else "S"}",
                                        color = nocturne.gold,
                                        fontSize = 14.sp
                                    )
                                }
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(28.dp), modifier = Modifier.padding(top = 8.dp)) {
                            ProfileStat(label = "Paired devices", value = "${profile.pairedDeviceCount}")
                            ProfileStat(label = "Posts", value = "${profile.posts.size}")
                        }
                    }
                }
            }
            item {
                QuickUpdateComposer(viewModel = viewModel)
            }
            item {
                Column {
                    ProfileButton(label = "Pair new TV", onClick = { viewModel.navigateTo(Screen.Pairing) }, modifier = Modifier.fillMaxWidth())
                    Spacer(modifier = Modifier.height(12.dp))
                    ProfileButton(label = "Settings", onClick = { viewModel.navigateTo(Screen.Settings) }, modifier = Modifier.fillMaxWidth())
                    Spacer(modifier = Modifier.height(12.dp))
                    ProfileButton(label = "Sign out", onClick = { viewModel.signOut() }, modifier = Modifier.fillMaxWidth())
                }
            }
            if (profile.posts.isNotEmpty()) {
                val pageCount = (profile.posts.size + POSTS_PER_PAGE - 1) / POSTS_PER_PAGE
                item {
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.padding(top = 16.dp)) {
                        Text(text = "Your posts", color = nocturne.text, fontSize = 28.sp)
                        Text(
                            text = "Page ${page + 1} of $pageCount · ${profile.posts.size} posts",
                            color = nocturne.textFaint,
                            fontSize = 17.sp
                        )
                    }
                }
                item {
                    val pagePosts = profile.posts.drop(page * POSTS_PER_PAGE).take(POSTS_PER_PAGE)
                    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                        pagePosts.forEach { post ->
                            ProfilePostCard(body = post.body, imageUrl = post.mediaUrl)
                        }
                    }
                }
                if (pageCount > 1) {
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(top = 16.dp)) {
                            ProfileButton(label = "Previous page", onClick = { TvSoundManager.play("page"); if (page > 0) page-- })
                            ProfileButton(label = "Next page", onClick = { TvSoundManager.play("page"); if (page < pageCount - 1) page++ })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickUpdateComposer(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier
                .weight(1f)
                .clip(RoundedCornerShape(12.dp))
                .border(if (focused) 2.dp else 1.dp, if (focused) nocturne.gold else nocturne.borderCard, RoundedCornerShape(12.dp))
                .clickable(interactionSource = interactionSource, indication = null, onClick = {})
                .padding(horizontal = 22.dp, vertical = 16.dp)
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_ph_pencil_simple_line),
                contentDescription = null,
                tint = if (focused) nocturne.goldLight else nocturne.textFaint,
                modifier = Modifier.size(22.dp)
            )
            Text(
                text = "Quick update — what are you watching?",
                color = if (focused) nocturne.text else nocturne.textFaint,
                fontSize = 18.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        ProfileButton(label = "Edit profile", onClick = {})
    }
}

@Composable
private fun ProfileStat(label: String, value: String) {
    val nocturne = LocalNocturne.current
    Column {
        Text(text = value, color = nocturne.text, fontSize = 22.sp, fontWeight = FontWeight.Medium)
        Text(text = label, color = nocturne.textFaint, fontSize = 15.sp)
    }
}

@Composable
private fun ProfilePostCard(body: String, imageUrl: String?) {
    val nocturne = LocalNocturne.current
    Box(
        modifier = Modifier
            .width(250.dp)
            .height(190.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(nocturne.surface),
        contentAlignment = Alignment.Center
    ) {
        if (!imageUrl.isNullOrBlank()) {
            AsyncImage(
                model = rememberCacheableImageRequest(imageUrl),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Text(
                text = body,
                color = nocturne.textMuted,
                fontSize = 15.sp,
                maxLines = 5,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(16.dp)
            )
        }
    }
}

@Composable
private fun ProfileButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }

    Box(
        modifier = modifier
            .height(64.dp)
            .clip(RoundedCornerShape(12.dp))
            .border(
                2.dp,
                if (focused) nocturne.accent else nocturne.borderCard,
                RoundedCornerShape(12.dp)
            )
            .background(nocturne.surface)
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = 28.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Text(text = label, color = nocturne.text, fontSize = 22.sp)
    }
}

private fun initials(name: String): String {
    return name.split(" ").mapNotNull { it.firstOrNull() }.take(2).joinToString("").uppercase().ifBlank { "AV" }
}

private fun formatTier(rawPlan: String, isPremiumCreator: Boolean): String {
    if (rawPlan.isBlank()) {
        return if (isPremiumCreator) "PREMIUM CREATOR" else "FREE PLAN"
    }
    return rawPlan.replace("_", " ").replace("-", " ").uppercase()
}
