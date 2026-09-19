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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.data.MediaCard
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.data.toPlayerMedia
import com.afrovision.tv.ui.theme.LocalNocturne

@Composable
fun RailRow(
    title: String,
    subtitle: String = "",
    items: List<MediaCard>,
    viewModel: TvViewModel,
    aspect: Pair<Float, Float> = 16f to 9f,
    cardWidth: Int = 180
) {
    val nocturne = LocalNocturne.current

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 24.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 60.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = title,
                color = nocturne.text,
                fontSize = 28.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (subtitle.isNotBlank()) {
                Text(
                    text = subtitle,
                    color = nocturne.textFaint,
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
                contentPadding = PaddingValues(horizontal = 60.dp),
                horizontalArrangement = Arrangement.spacedBy(22.dp)
            ) {
                itemsIndexed(items, key = { _, item -> item.id }) { _, item ->
                    FocusCard(
                        item = item,
                        aspect = aspect,
                        onClick = {
                            // Books open the reader; everything else plays.
                            val channelId = item.channelId
                            if (item.mediaType == "library" && !channelId.isNullOrBlank()) {
                                viewModel.openReaderItem(channelId, item.id)
                            } else {
                                viewModel.play(item.toPlayerMedia())
                            }
                        },
                        modifier = Modifier.width(cardWidth.dp)
                    )
                }
            }
        }
    }
}
