import 'movie_model.dart';
import 'series_model.dart';

/// Unified arguments for starting the VOD player for a movie or an episode.
class VodPlaybackArgs {
  final String mediaType; // 'movie' or 'episode'
  final String mediaId;
  final String channelId;
  final String title;
  final String? synopsis;
  final String? posterUrl;
  final String videoSourceMode;
  final String? playbackUrl;
  final int duration;
  final bool downloadable;

  // Series-specific
  final String? seriesId;
  final SeriesModel? series;
  final EpisodeModel? episode;
  final String? nextEpisodeId;
  final String? previousEpisodeId;

  const VodPlaybackArgs({
    required this.mediaType,
    required this.mediaId,
    required this.channelId,
    required this.title,
    this.synopsis,
    this.posterUrl,
    required this.videoSourceMode,
    this.playbackUrl,
    required this.duration,
    required this.downloadable,
    this.seriesId,
    this.series,
    this.episode,
    this.nextEpisodeId,
    this.previousEpisodeId,
  });

  factory VodPlaybackArgs.fromMovie(MovieModel movie) {
    return VodPlaybackArgs(
      mediaType: 'movie',
      mediaId: movie.id,
      channelId: movie.channelId,
      title: movie.title,
      synopsis: movie.synopsis,
      posterUrl: movie.posterUrl,
      videoSourceMode: movie.videoSourceMode,
      playbackUrl: movie.playbackUrl,
      duration: movie.duration,
      downloadable: movie.downloadable,
    );
  }

  factory VodPlaybackArgs.fromEpisode(
    SeriesModel series,
    EpisodeModel episode, {
    String? nextEpisodeId,
    String? previousEpisodeId,
  }) {
    return VodPlaybackArgs(
      mediaType: 'episode',
      mediaId: episode.id,
      channelId: series.channelId,
      seriesId: series.id,
      title: episode.title,
      synopsis: episode.synopsis,
      posterUrl: episode.posterUrl,
      videoSourceMode: episode.videoSourceMode,
      playbackUrl: episode.playbackUrl,
      duration: episode.duration,
      downloadable: episode.downloadable,
      series: series,
      episode: episode,
      nextEpisodeId: nextEpisodeId,
      previousEpisodeId: previousEpisodeId,
    );
  }
}
