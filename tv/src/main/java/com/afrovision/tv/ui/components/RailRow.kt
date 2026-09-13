package com.afrovision.tv.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import com.afrovision.tv.data.MediaCard
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.toPlayerMedia
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun <T> RailRow(
    title: String,
    subtitle: String = "",
    items: List<T>,
    cardContent: @Composable (T) -> Unit,
    trailingTile: @Composable (() -> Unit)? = null,
    topPadding: Dp = 28.dp
) {
    val nocturne = LocalNocturne.current

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 60.dp, top = topPadding, bottom = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = title,
                color = nocturne.text,
                fontSize = 31.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (subtitle.isNotBlank()) {
                Text(
                    text = subtitle,
                    color = nocturne.textHint,
                    fontSize = 18.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        if (items.isEmpty() && trailingTile == null) {
            Spacer(modifier = Modifier.height(0.dp))
        } else {
            LazyRow(
                contentPadding = PaddingValues(start = 6.dp, top = 12.dp, end = 60.dp, bottom = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                itemsIndexed(items, key = { _, item ->
                    when (item) {
                        is MediaCard -> item.id
                        else -> item.hashCode().toString()
                    }
                }) { _, item ->
                    cardContent(item)
                }

                if (trailingTile != null) {
                    item {
                        trailingTile()
                    }
                }
            }
        }
    }
}

@Composable
fun RailRow(
    title: String,
    subtitle: String = "",
    items: List<MediaCard>,
    viewModel: TvViewModel,
    aspect: Pair<Float, Float> = 16f to 9f,
    cardWidth: Int = 180,
    topPadding: Dp = 28.dp
) {
    val nocturne = LocalNocturne.current

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 60.dp, top = topPadding, bottom = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = title,
                color = nocturne.text,
                fontSize = 31.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (subtitle.isNotBlank()) {
                Text(
                    text = subtitle,
                    color = nocturne.textHint,
                    fontSize = 18.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        if (items.isEmpty()) {
            Spacer(modifier = Modifier.height(0.dp))
        } else {
            LazyRow(
                contentPadding = PaddingValues(start = 6.dp, top = 12.dp, end = 60.dp, bottom = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                itemsIndexed(items, key = { _, item -> item.id }) { _, item ->
                    FocusCard(
                        item = item,
                        aspect = aspect,
                        onClick = { viewModel.play(item.toPlayerMedia()) },
                        modifier = Modifier.width(cardWidth.dp)
                    )
                }
            }
        }
    }
}
