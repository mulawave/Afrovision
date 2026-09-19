import 'package:flutter/material.dart';

import '../../../core/services/network_profile_service.dart';
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
    _initFuture = Future.wait([
      PlayerSettingsService.instance.initialize(),
      NetworkProfileService.instance.initialize(),
    ]).then((_) {});
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
                  ValueListenableBuilder<PlaybackCapabilities>(
                    valueListenable: PlayerSettingsService.instance.capabilitiesNotifier,
                    builder: (context, capabilities, _) => _buildQualityOptions(settings, capabilities),
                  ),
                  const SizedBox(height: 24),
                  _buildSectionTitle('Player Engine'),
                  _buildEngineOptions(settings),
                  const SizedBox(height: 24),
                  _buildSectionTitle('Network'),
                  _buildNetworkOptions(settings),
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

  Future<void> _setWifiOnlyStreaming(bool value) async {
    await PlayerSettingsService.instance.setWifiOnlyStreaming(value);
    _showWatchSettingSaved(value ? 'Wi-Fi-only streaming enabled' : 'Wi-Fi-only streaming disabled');
  }

  Future<void> _setDataSaverOnCellular(bool value) async {
    await PlayerSettingsService.instance.setDataSaverOnCellular(value);
    _showWatchSettingSaved(value ? 'Data saver on cellular enabled' : 'Data saver on cellular disabled');
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

  Widget _buildQualityOptions(PlayerSettings settings, PlaybackCapabilities capabilities) {
    return Column(
      children: QualityProfile.values.map((profile) {
        final supported = capabilities.supports(profile);
        return _buildRadioTile<QualityProfile>(
          value: profile,
          groupValue: settings.quality,
          title: profile.label,
          subtitle: supported
              ? profile.description
              : 'Unavailable — this server isn\'t producing this quality yet',
          enabled: supported,
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

  Widget _buildNetworkOptions(PlayerSettings settings) {
    final currentType = NetworkProfileService.instance.currentType;
    final currentLabel = switch (currentType) {
      NetworkType.wifi => 'Wi-Fi',
      NetworkType.cellular => 'Cellular',
      NetworkType.unknown => 'Unknown',
    };
    final currentCap = NetworkProfileService.instance.maxHlsBitrateBps;
    final capLabel = currentCap == null
        ? 'No cap'
        : '${(currentCap / 1000000).toStringAsFixed(1)} Mbps cap';

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: AppColors.cardBg,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              const Icon(Icons.wifi_tethering_rounded, color: AppColors.hintText, size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Currently on $currentLabel · $capLabel',
                  style: const TextStyle(color: AppColors.hintText, fontSize: 12),
                ),
              ),
            ],
          ),
        ),
        _buildSwitchTile(
          title: 'Wi-Fi-only streaming',
          subtitle: 'Refuse to start playback unless connected to Wi-Fi',
          value: settings.wifiOnlyStreaming,
          onChanged: _setWifiOnlyStreaming,
        ),
        const SizedBox(height: 8),
        _buildSwitchTile(
          title: 'Data saver on cellular',
          subtitle: 'Cap streams at the Data Saver bitrate whenever off Wi-Fi',
          value: settings.dataSaverOnCellular,
          onChanged: _setDataSaverOnCellular,
        ),
      ],
    );
  }

  Widget _buildSwitchTile({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: SwitchListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
        value: value,
        onChanged: onChanged,
        activeColor: AppColors.orange,
        title: Text(
          title,
          style: const TextStyle(color: AppColors.white, fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          subtitle,
          style: const TextStyle(color: AppColors.hintText, fontSize: 12),
        ),
      ),
    );
  }

  Widget _buildRadioTile<T>({
    required T value,
    required T groupValue,
    required String title,
    String? subtitle,
    required ValueChanged<T?> onChanged,
    bool enabled = true,
  }) {
    final selected = value == groupValue;
    return GestureDetector(
      onTap: enabled ? () => onChanged(value) : null,
      child: Opacity(
        opacity: enabled ? 1.0 : 0.45,
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

  // The live player always buffers up to 120s ahead of playback position
  // regardless of this setting — live delay only controls how far behind
  // the live edge you start, giving the buffer a head start before you
  // catch up to it. It does not itself make the buffer larger or smaller.
  String _delayWarning(int seconds) {
    return switch (seconds) {
      0 =>
        'No live delay — closest to live. The buffer has no head start, so a network dip is more likely to cause visible rebuffering.',
      5 =>
        '5 seconds behind live — a small head start for the buffer. Works best on strong Wi-Fi.',
      10 =>
        '10 seconds behind live — a bit more headroom before you catch up to the buffer.',
      15 =>
        '15 seconds behind live — a moderate head start. Good balance on fast cellular.',
      30 =>
        '30 seconds behind live — the safest default. Gives the buffer the most head start, reducing the chance of catching up to it during a network dip.',
      _ =>
        '$seconds seconds behind live — adjust based on your network stability.',
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
