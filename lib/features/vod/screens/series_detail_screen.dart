import 'package:flutter/material.dart';

import '../../channel/screens/channel_series_detail_screen.dart';
import '../../channel/services/channel_content_service.dart';
import '../models/series_model.dart';

/// Unified wrapper so any caller pushing [SeriesDetailScreen] (Continue Watching,
/// Media Center Series tab, Search, Watch History) opens the unified
/// [ChannelSeriesDetailScreen] with intelligent Stream/Resume/Replay/Play Offline,
/// TMDB cast & metadata, sorting, view modes, pagination, and download controls.
class SeriesDetailScreen extends StatelessWidget {
  final SeriesModel series;

  const SeriesDetailScreen({super.key, required this.series});

  ChannelSeriesDetail? _toInitialDetail() {
    if (series.seasons.isEmpty) return null;
    final seasons = series.seasons.map((s) {
      final eps = s.episodes
          .map(
            (e) => ChannelEpisode(
              id: e.id,
              seasonId: e.seasonId,
              title: e.title,
              episodeNumber: e.episodeNumber,
              videoUrl: e.playbackUrl,
              hostedUrl: e.hostedUrl,
              externalUrl: e.externalUrl,
              hlsUrl: e.hlsUrl,
              embedUrl: e.embedUrl,
              videoSourceMode: e.videoSourceMode,
              duration: e.duration,
              status: e.status,
            ),
          )
          .toList();
      return ChannelSeason(
        id: s.id,
        seriesId: series.id,
        seasonNumber: s.seasonNumber,
        title: s.title,
        episodes: eps,
      );
    }).toList();

    return ChannelSeriesDetail(
      id: series.id,
      channelId: series.channelId,
      title: series.title,
      description: series.description ?? '',
      coverUrl: series.coverUrl,
      status: series.status,
      seasons: seasons,
    );
  }

  @override
  Widget build(BuildContext context) {
    return ChannelSeriesDetailScreen(
      channelId: series.channelId,
      series: ChannelSeries(
        id: series.id,
        channelId: series.channelId,
        title: series.title,
        description: series.description ?? '',
        coverUrl: series.coverUrl,
        status: series.status,
      ),
      initialDetail: _toInitialDetail(),
    );
  }
}
