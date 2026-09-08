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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.ui.navigation.Screen
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun ProfileScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val profile = viewModel.profile
    val userName = viewModel.userName.collectAsState("").value

    LaunchedEffect(Unit) { viewModel.loadProfile() }

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
        LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(60.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
            item {
                Text(text = "Profile", color = nocturne.text, fontSize = 42.sp, modifier = Modifier.padding(bottom = 24.dp))
            }
            item {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(28.dp)) {
                    Box(
                        modifier = Modifier
                            .size(120.dp)
                            .clip(RoundedCornerShape(60))
                            .background(nocturne.accent900)
                            .border(2.dp, nocturne.accent700, RoundedCornerShape(60)),
                        contentAlignment = Alignment.Center
                    ) {
                        if (profile.avatar.isNotBlank()) {
                            AsyncImage(model = profile.avatar, contentDescription = null, modifier = Modifier.fillMaxSize())
                        } else {
                            Text(text = initials(profile.name), color = nocturne.accentLight, fontSize = 40.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(text = profile.name.ifBlank { userName }, color = nocturne.text, fontSize = 36.sp, fontWeight = FontWeight.Medium)
                        Text(text = profile.tier.uppercase(), color = nocturne.accent, fontSize = 18.sp)
                        Text(text = "${profile.pairedDeviceCount} paired devices", color = nocturne.textFaint, fontSize = 18.sp)
                    }
                }
            }
            item {
                ProfileButton(label = "Pair new TV", onClick = { viewModel.navigateTo(Screen.Pairing) })
                Spacer(modifier = Modifier.height(12.dp))
                ProfileButton(label = "Settings", onClick = { viewModel.navigateTo(Screen.Settings) })
                Spacer(modifier = Modifier.height(12.dp))
                ProfileButton(label = "Sign out", onClick = { viewModel.signOut() })
            }
            if (profile.posts.isNotEmpty()) {
                item {
                    Text(text = "Your posts", color = nocturne.text, fontSize = 28.sp, modifier = Modifier.padding(top = 24.dp))
                }
            }
        }
    }
}

@Composable
private fun ProfileButton(label: String, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    var focused by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(64.dp)
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
            .clickable(onClick = onClick)
            .padding(horizontal = 28.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Text(text = label, color = nocturne.text, fontSize = 22.sp)
    }
}

private fun initials(name: String): String {
    return name.split(" ").mapNotNull { it.firstOrNull() }.take(2).joinToString("").uppercase().ifBlank { "AV" }
}
