import 'package:flutter/material.dart';

import '../../../core/services/app_preferences_service.dart';
import '../../../core/services/pip_service.dart';
import '../../../core/services/player_settings_service.dart';
import '../../../core/services/video_cache_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/models/user_model.dart';
import '../../auth/services/profile_service.dart';
import '../../currency/currency_service.dart';
import '../../currency/models/currency_model.dart';
import 'watch_settings_screen.dart';

/// Consolidated account settings — playback, notifications, privacy and app.
///
/// Playback quality/engine live on [WatchSettingsScreen]; the toggles here
/// that have a real consumer elsewhere in the app (autoplay, picture in
/// picture, watch history) persist through [AppPreferencesService] and take
/// effect immediately. The rest (private profile, adult content, biometric
/// unlock, language) are stored the same way for the user's own reference —
/// there is no backend preferences sync or enforcement for those yet.
class AccountSettingsScreen extends StatefulWidget {
  const AccountSettingsScreen({super.key});

  @override
  State<AccountSettingsScreen> createState() => _AccountSettingsScreenState();
}

class _AccountSettingsScreenState extends State<AccountSettingsScreen> {
  bool _loading = true;
  bool _autoplay = true;
  bool _alwaysHd = false;
  bool _pip = true;
  bool _private = false;
  bool _saveHistory = true;
  bool _adultContent = false;
  bool _biometric = false;
  int _cacheMb = 0;
  List<CurrencyModel> _currencies = [];
  String _currency = 'NGN';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final results = await Future.wait<dynamic>([
      AppPreferencesService.autoplayNext,
      AppPreferencesService.alwaysStreamHd,
      AppPreferencesService.pipEnabled,
      AppPreferencesService.privateProfile,
      AppPreferencesService.saveWatchHistory,
      AppPreferencesService.adultContent,
      AppPreferencesService.biometricUnlock,
      VideoCacheService.instance.getCacheSizeMB(),
      CurrencyService.getCurrencies().catchError((_) => <CurrencyModel>[]),
      ProfileService.getProfile().then<UserModel?>((v) => v).catchError((_) => null),
    ]);
    if (!mounted) return;
    final user = results[9] as UserModel?;
    setState(() {
      _autoplay = results[0] as bool;
      _alwaysHd = results[1] as bool;
      _pip = results[2] as bool;
      _private = results[3] as bool;
      _saveHistory = results[4] as bool;
      _adultContent = results[5] as bool;
      _biometric = results[6] as bool;
      _cacheMb = results[7] as int;
      _currencies = results[8] as List<CurrencyModel>;
      if (user != null) _currency = user.preferredCurrency;
      _loading = false;
    });
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(color: AppColors.white)),
        backgroundColor: AppColors.cardBg,
        duration: const Duration(milliseconds: 1600),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
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
          'Settings',
          style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w600),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_rounded, color: AppColors.orange),
            onPressed: () => Navigator.pushNamed(context, '/notifications'),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                _group('Playback', Icons.play_circle_fill_rounded, [
                  _switchTile(
                    label: 'Autoplay next',
                    note: 'Play the next item automatically',
                    icon: Icons.play_arrow_rounded,
                    value: _autoplay,
                    onChanged: (v) async {
                      await AppPreferencesService.setAutoplayNext(v);
                      setState(() => _autoplay = v);
                      _toast('Autoplay next ${v ? 'on' : 'off'}');
                    },
                  ),
                  _switchTile(
                    label: 'Always stream HD',
                    note: 'Uses more data on mobile networks',
                    icon: Icons.high_quality_rounded,
                    value: _alwaysHd,
                    onChanged: (v) async {
                      await AppPreferencesService.setAlwaysStreamHd(v);
                      await PlayerSettingsService.instance.setQuality(
                        v ? QualityProfile.best : QualityProfile.auto,
                      );
                      setState(() => _alwaysHd = v);
                      _toast('Always stream HD ${v ? 'on' : 'off'}');
                    },
                  ),
                  _switchTile(
                    label: 'Picture in picture',
                    note: 'Keep watching while you browse',
                    icon: Icons.picture_in_picture_alt_rounded,
                    value: _pip,
                    onChanged: (v) async {
                      await AppPreferencesService.setPipEnabled(v);
                      await PipService.setAutoEnterEnabled(v);
                      setState(() => _pip = v);
                      _toast('Picture in picture ${v ? 'on' : 'off'}');
                    },
                  ),
                  _linkTile(
                    label: 'Quality & player engine',
                    note: 'Live delay, streaming quality, player engine',
                    icon: Icons.speed_rounded,
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const WatchSettingsScreen()),
                    ),
                  ),
                ]),
                _group('Notifications', Icons.notifications_rounded, [
                  _linkTile(
                    label: 'Notification inbox',
                    note: 'View all your alerts',
                    icon: Icons.inbox_rounded,
                    onTap: () => Navigator.pushNamed(context, '/notifications'),
                  ),
                ]),
                _group('Privacy & security', Icons.shield_rounded, [
                  _switchTile(
                    label: 'Private profile',
                    note: 'Hide your activity from other members',
                    icon: Icons.visibility_off_rounded,
                    value: _private,
                    onChanged: (v) async {
                      await AppPreferencesService.setPrivateProfile(v);
                      setState(() => _private = v);
                      _toast('Private profile ${v ? 'on' : 'off'}');
                    },
                  ),
                  _switchTile(
                    label: 'Save watch history',
                    note: 'Powers Continue Watching',
                    icon: Icons.history_rounded,
                    value: _saveHistory,
                    onChanged: (v) async {
                      await AppPreferencesService.setSaveWatchHistory(v);
                      setState(() => _saveHistory = v);
                      _toast('Save watch history ${v ? 'on' : 'off'}');
                    },
                  ),
                  _switchTile(
                    label: 'Adult content (18+)',
                    note: 'Required for exclusive channels',
                    icon: Icons.warning_amber_rounded,
                    value: _adultContent,
                    onChanged: (v) async {
                      await AppPreferencesService.setAdultContent(v);
                      setState(() => _adultContent = v);
                      _toast('Adult content ${v ? 'on' : 'off'}');
                    },
                  ),
                  _switchTile(
                    label: 'Biometric unlock',
                    note: 'Face or fingerprint on app open',
                    icon: Icons.fingerprint_rounded,
                    value: _biometric,
                    onChanged: (v) async {
                      await AppPreferencesService.setBiometricUnlock(v);
                      setState(() => _biometric = v);
                      _toast('Biometric unlock ${v ? 'on' : 'off'}');
                    },
                  ),
                  _linkTile(
                    label: 'Personal identifier codes',
                    note: 'Account, device and referral codes',
                    icon: Icons.badge_rounded,
                    onTap: () => Navigator.pushNamed(context, '/identifier-codes'),
                  ),
                ]),
                _group('App', Icons.settings_rounded, [
                  _valueTile(
                    label: 'Preferred currency',
                    value: _currency,
                    icon: Icons.currency_exchange_rounded,
                    onTap: _pickCurrency,
                  ),
                  _valueTile(
                    label: 'Clear cache',
                    value: '$_cacheMb MB',
                    icon: Icons.cleaning_services_rounded,
                    onTap: () async {
                      await VideoCacheService.instance.clearCache();
                      final size = await VideoCacheService.instance.getCacheSizeMB();
                      if (!mounted) return;
                      setState(() => _cacheMb = size);
                      _toast('Cache cleared');
                    },
                  ),
                  _linkTile(
                    label: 'Legal & static pages',
                    note: 'Terms, privacy, community rules',
                    icon: Icons.menu_book_rounded,
                    onTap: () => Navigator.pushNamed(context, '/legal'),
                  ),
                  _linkTile(
                    label: 'Help & support',
                    note: 'Contact the AfroVision team',
                    icon: Icons.support_agent_rounded,
                    onTap: () => Navigator.pushNamed(context, '/contact'),
                  ),
                ]),
                const SizedBox(height: 12),
              ],
            ),
    );
  }

  Future<void> _pickCurrency() async {
    if (_currencies.isEmpty) return;
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: _currencies
              .map((c) => ListTile(
                    title: Text('${c.symbol} ${c.code}',
                        style: const TextStyle(color: AppColors.white)),
                    trailing: c.code == _currency
                        ? const Icon(Icons.check_rounded, color: AppColors.orange)
                        : null,
                    onTap: () => Navigator.pop(ctx, c.code),
                  ))
              .toList(),
        ),
      ),
    );
    if (picked == null || picked == _currency) return;
    try {
      await CurrencyService.updatePreferredCurrency(picked);
      setState(() => _currency = picked);
      _toast('Preferred currency · $picked');
    } catch (e) {
      _toast(e.toString());
    }
  }

  Widget _group(String title, IconData icon, List<Widget> rows) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 10, left: 4),
            child: Row(
              children: [
                Icon(icon, color: AppColors.lightOrange, size: 16),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
          Container(
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: Column(children: rows),
          ),
        ],
      ),
    );
  }

  Widget _row({
    required String label,
    String? note,
    required IconData icon,
    required Widget trailing,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.orange.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: AppColors.orange, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (note != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      note,
                      style: TextStyle(
                        color: AppColors.white.withValues(alpha: 0.5),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            trailing,
          ],
        ),
      ),
    );
  }

  Widget _switchTile({
    required String label,
    required String note,
    required IconData icon,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return _row(
      label: label,
      note: note,
      icon: icon,
      onTap: () => onChanged(!value),
      trailing: Switch(
        value: value,
        onChanged: onChanged,
        activeColor: AppColors.orange,
      ),
    );
  }

  Widget _linkTile({
    required String label,
    required String note,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return _row(
      label: label,
      note: note,
      icon: icon,
      onTap: onTap,
      trailing: Icon(Icons.chevron_right_rounded,
          color: AppColors.white.withValues(alpha: 0.3)),
    );
  }

  Widget _valueTile({
    required String label,
    required String value,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return _row(
      label: label,
      icon: icon,
      onTap: onTap,
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.inputFill,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          value,
          style: const TextStyle(
            color: AppColors.orange,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
