import 'package:flutter/material.dart';

import '../../../core/services/player_settings_service.dart';
import '../../../core/services/telemetry_service.dart';
import '../../../core/theme/app_colors.dart';

/// User-facing settings for the channel watch player.
///
/// Lets viewers choose the live delay, the quality / data trade-off for
/// adaptive streams, and the underlying player engine (`media_kit` or
/// `video_player`).
class WatchSettingsScreen extends StatefulWidget {
  const WatchSettingsScreen({super.key});

  @override
  State<WatchSettingsScreen> createState() => _WatchSettingsScreenState();
}

class _WatchSettingsScreenState extends State<WatchSettingsScreen> {
  late final Future<void> _initFuture;

  @override
  void initState() {
    super.initState();
    TelemetryService.marker('watch_settings_opened');
    _initFuture = PlayerSettingsService.instance.initialize();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBlue,
      appBar: AppBar(
        backgroundColor: AppColors.cardBg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: AppColors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Watch Settings',
          style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w600),
        ),
      ),
      body: FutureBuilder<void>(
        future: _initFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
              ),
            );
          }

          return ValueListenableBuilder<PlayerSettings>(
            valueListenable: PlayerSettingsService.instance.notifier,
            builder: (context, settings, _) {
              return ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  _buildSectionTitle('Live Delay'),
                  _buildDelayOptions(settings),
                  const SizedBox(height: 24),
                  _buildSectionTitle('Quality / Data'),
                  _buildQualityOptions(settings),
                  const SizedBox(height: 24),
                  _buildSectionTitle('Player Engine'),
                  _buildEngineOptions(settings),
                  const SizedBox(height: 32),
                  _buildWarningCard(settings),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        title,
        style: const TextStyle(
          color: AppColors.lightOrange,
          fontSize: 14,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Future<void> _setLiveDelay(int seconds) async {
    await PlayerSettingsService.instance.setLiveDelay(seconds);
    _showWatchSettingSaved('Live delay set to ${seconds == 0 ? "None" : "$seconds seconds"}');
  }

  Future<void> _setQuality(QualityProfile quality) async {
    await PlayerSettingsService.instance.setQuality(quality);
    _showWatchSettingSaved('Quality set to ${quality.label}');
  }

  Future<void> _setUseMediaKit(bool value) async {
    await PlayerSettingsService.instance.setUseMediaKit(value);
    _showWatchSettingSaved('Player engine set to ${value ? 'media_kit' : 'video_player'}');
  }

  void _showWatchSettingSaved(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '$message. Player will refresh if needed.',
          style: const TextStyle(color: AppColors.white),
        ),
        backgroundColor: AppColors.cardBg,
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }

  Widget _buildDelayOptions(PlayerSettings settings) {
    const options = <int>[30, 15, 10, 5, 0];
    return Column(
      children: options.map((seconds) {
        final label = seconds == 0 ? 'None' : '$seconds seconds';
        return _buildRadioTile<int>(
          value: seconds,
          groupValue: settings.liveDelaySeconds,
          title: label,
          onChanged: (v) => _setLiveDelay(v!),
        );
      }).toList(),
    );
  }

  Widget _buildQualityOptions(PlayerSettings settings) {
    return Column(
      children: QualityProfile.values.map((profile) {
        return _buildRadioTile<QualityProfile>(
          value: profile,
          groupValue: settings.quality,
          title: profile.label,
          subtitle: profile.description,
          onChanged: (v) => _setQuality(v!),
        );
      }).toList(),
    );
  }

  Widget _buildEngineOptions(PlayerSettings settings) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          _buildRadioTile<bool>(
            value: true,
            groupValue: settings.useMediaKit,
            title: 'media_kit',
            subtitle: 'Recommended — larger buffer, better HLS/MPV control',
            onChanged: (v) => _setUseMediaKit(v!),
          ),
          const Divider(height: 1, color: AppColors.inputBorder, indent: 56),
          _buildRadioTile<bool>(
            value: false,
            groupValue: settings.useMediaKit,
            title: 'video_player',
            subtitle: 'Legacy engine — use if media_kit is unstable',
            onChanged: (v) => _setUseMediaKit(v!),
          ),
        ],
      ),
    );
  }

  Widget _buildRadioTile<T>({
    required T value,
    required T groupValue,
    required String title,
    String? subtitle,
    required ValueChanged<T?> onChanged,
  }) {
    final selected = value == groupValue;
    return GestureDetector(
      onTap: () => onChanged(value),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(12),
          border: selected
              ? Border.all(color: AppColors.orange.withValues(alpha: 0.5))
              : null,
        ),
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          leading: Icon(
            selected
                ? Icons.radio_button_checked_rounded
                : Icons.radio_button_unchecked_rounded,
            color: selected ? AppColors.orange : AppColors.inputBorder,
          ),
          title: Text(
            title,
            style: const TextStyle(
              color: AppColors.white,
              fontWeight: FontWeight.w600,
            ),
          ),
          subtitle: subtitle != null
              ? Text(
                  subtitle,
                  style: const TextStyle(
                    color: AppColors.hintText,
                    fontSize: 12,
                  ),
                )
              : null,
        ),
      ),
    );
  }

  Widget _buildWarningCard(PlayerSettings settings) {
    final parts = <String>[
      _delayWarning(settings.liveDelaySeconds),
      _qualityWarning(settings.quality),
      _engineWarning(settings.useMediaKit),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.lightBlue.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.lightBlue.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.info_outline, color: AppColors.infoBlue, size: 18),
              SizedBox(width: 8),
              Text(
                'What this means',
                style: TextStyle(
                  color: AppColors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...parts.map((text) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  text,
                  style: const TextStyle(color: AppColors.white, fontSize: 13),
                ),
              )),
        ],
      ),
    );
  }

  String _delayWarning(int seconds) {
    return switch (seconds) {
      0 =>
        'No live delay — closest to live, but the player has almost no buffer. Expect frequent rebuffering on cellular.',
      5 =>
        '5 seconds — near-live playback. Works best on strong Wi-Fi; may rebuffer on cellular.',
      10 =>
        '10 seconds — small buffer. Better on Wi-Fi; occasional rebuffering on cellular.',
      15 =>
        '15 seconds — moderate buffer. Good balance on fast cellular.',
      30 =>
        '30 seconds — safest default. The player can build a large buffer ahead, reducing rebuffering at the cost of living a few seconds behind.',
      _ =>
        '$seconds seconds — adjust based on your network stability.',
    };
  }

  String _qualityWarning(QualityProfile profile) {
    return switch (profile) {
      QualityProfile.dataSaver =>
        'Data Saver uses the least data, but video will look soft or pixelated on large screens.',
      QualityProfile.balanced =>
        'Balanced is the recommended default — good quality with controlled data use.',
      QualityProfile.quality =>
        'Quality uses more data and looks sharp. Best on Wi-Fi or unlimited plans.',
      QualityProfile.best =>
        'Best uses the most data. Avoid on limited cellular plans.',
      QualityProfile.auto =>
        'Auto lets the player pick the highest sustainable quality, so data use may vary.',
    };
  }

  String _engineWarning(bool useMediaKit) {
    return useMediaKit
        ? 'media_kit is the new player engine with larger buffers and better live-stream recovery.'
        : 'video_player is the legacy engine. Only use this if media_kit is unstable on this device.';
  }
}
