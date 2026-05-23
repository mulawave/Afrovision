import 'dart:io';
import '../../../core/api/api_service.dart';
import '../models/channel_model.dart';
import '../models/category_model.dart';

class FollowStatusModel {
  final bool followed;
  final int followersCount;

  const FollowStatusModel({
    required this.followed,
    required this.followersCount,
  });

  factory FollowStatusModel.fromJson(Map<String, dynamic> json) {
    return FollowStatusModel(
      followed: json['followed'] as bool? ?? false,
      followersCount: (json['followers_count'] as num?)?.toInt() ?? 0,
    );
  }
}

class ChannelService {
  static Future<List<CategoryModel>> getCategories() async {
    final data = await ApiService.get('/categories');
    final list = data['categories'] as List<dynamic>;
    return list
        .map((e) => CategoryModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<ChannelModel> createChannel({
    required String name,
    required String description,
    required String category,
    required String type,
  }) async {
    final data = await ApiService.post('/channels', {
      'name': name,
      'description': description,
      'category': category,
      'type': type,
    });
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  static Future<List<ChannelModel>> getPublicChannels() async {
    final data = await ApiService.get('/channels');
    final list = data['channels'] as List<dynamic>;
    return list
        .map((e) => ChannelModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<ChannelModel> getChannelById(String id) async {
    final data = await ApiService.get('/channels/$id');
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  static Future<ChannelModel> getChannelByNumber(String number) async {
    final data = await ApiService.get('/channels/number/$number');
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  static Future<ChannelModel> updateChannel(
    String id, {
    String? name,
    String? description,
    String? category,
  }) async {
    final data = await ApiService.patch('/channels/$id', {
      if (name != null) 'name': name,
      if (description != null) 'description': description,
      if (category != null) 'category': category,
    });
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  static Future<void> deleteChannel(String id) async {
    await ApiService.delete('/channels/$id');
  }

  static Future<List<ChannelModel>> getMyChannels() async {
    final data = await ApiService.get('/channels/me');
    final list = data['channels'] as List<dynamic>;
    return list
        .map((e) => ChannelModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<ChannelModel> enableChannel(String id) async {
    final data = await ApiService.patch('/channels/$id/enable', {});
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  static Future<ChannelModel> uploadLogo(String id, File file) async {
    final data = await ApiService.uploadFile('/channels/$id/upload/logo', file);
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  static Future<ChannelModel> uploadBanner(String id, File file) async {
    final data = await ApiService.uploadFile(
      '/channels/$id/upload/banner',
      file,
    );
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  /// Returns channels belonging to creators the authenticated user subscribes to.
  static Future<List<ChannelModel>> getSubscriberFeed() async {
    final data = await ApiService.get('/channels/subscriber-feed');
    final list = data['channels'] as List<dynamic>;
    return list
        .map((e) => ChannelModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<FollowStatusModel> getFollowStatus(String creatorId) async {
    final data = await ApiService.get('/users/follows/$creatorId');
    return FollowStatusModel.fromJson(data);
  }

  static Future<FollowStatusModel> followCreator(String creatorId) async {
    final data = await ApiService.post('/users/follows/$creatorId', {});
    return FollowStatusModel.fromJson(data);
  }

  static Future<FollowStatusModel> unfollowCreator(String creatorId) async {
    final data = await ApiService.delete('/users/follows/$creatorId');
    return FollowStatusModel.fromJson(data);
  }

  static Future<void> recordView(String channelId) async {
    await ApiService.post('/channels/$channelId/view', {});
  }

  /// Updates the external stream source for a channel. The backend automatically
  /// classifies and probes the URL, returning the enriched channel with
  /// resolved_playback_url and stream_status populated.
  static Future<ChannelModel> updateExternalSource(
    String id, {
    required String streamSourceMode,
    String? externalUrl,
    String? externalProvider,
  }) async {
    final data = await ApiService.patch('/channels/$id/external-source', {
      'stream_source_mode': streamSourceMode,
      if (externalUrl != null && externalUrl.isNotEmpty)
        'external_url': externalUrl,
      if (externalProvider != null && externalProvider.isNotEmpty)
        'external_provider': externalProvider,
    });
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  /// Validates a URL against the resolver without persisting anything.
  /// Returns the resolved source contract on success.
  static Future<Map<String, dynamic>> resolveSource(String url) async {
    return await ApiService.post('/channels/resolve-source', {'url': url});
  }

  /// Re-probes the currently configured source URL and persists the refreshed
  /// stream_status and last_checked_at on the channel.
  static Future<ChannelModel> recheckStreamHealth(String id) async {
    final data = await ApiService.post('/channels/$id/recheck-source', {});
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }

  static Future<ChannelModel> updateExclusiveSettings(
    String id, {
    required double monthlyFeeNgn,
  }) async {
    final data = await ApiService.patch('/channels/$id/exclusive-settings', {
      'monthly_fee_ngn': monthlyFeeNgn,
    });
    return ChannelModel.fromJson(data['channel'] as Map<String, dynamic>);
  }
}
