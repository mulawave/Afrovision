import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../features/kyc/services/kyc_service.dart';
import '../theme/app_colors.dart';
import '../api/api_service.dart';

/// Shows a one-time bottom sheet prompting users with verified/pending KYC
/// but no gender on record to complete their profile.
class KycGenderChecker {
  static const _promptedKey = 'kyc_gender_prompted';

  static Future<void> checkAndPrompt(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_promptedKey) == true) return;

    try {
      final data = await KycService.getMe();
      if (data == null) return;
      final status = data['status'] as String?;
      final gender = data['gender'] as String?;
      // Only prompt if KYC exists and gender is missing
      if (status == null || (gender != null && gender.isNotEmpty)) return;
      if (!['pending', 'under_review', 'verified'].contains(status)) return;
    } catch (_) {
      return; // No KYC record — don't prompt
    }

    await prefs.setBool(_promptedKey, true);

    if (!context.mounted) return;
    await showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => const _GenderCompletionSheet(),
    );
  }

  /// Reset the prompt so it shows again (e.g. for testing).
  static Future<void> reset() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_promptedKey);
  }
}

class _GenderCompletionSheet extends StatefulWidget {
  const _GenderCompletionSheet();

  @override
  State<_GenderCompletionSheet> createState() => _GenderCompletionSheetState();
}

class _GenderCompletionSheetState extends State<_GenderCompletionSheet> {
  static const _options = [
    {'value': 'male', 'label': 'Male'},
    {'value': 'female', 'label': 'Female'},
    {'value': 'non_binary', 'label': 'Non-binary'},
    {'value': 'prefer_not_to_say', 'label': 'Prefer not to say'},
  ];

  String? _selected;
  bool _saving = false;
  String? _error;

  Future<void> _save() async {
    if (_selected == null) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ApiService.patch('/kyc/gender', {'gender': _selected});
      KycService.invalidate();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Could not save. Please try again.';
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + bottom),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0E1A50), AppColors.darkBlue],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: AppColors.lightOrange.withValues(alpha: 0.25),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 24,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.inputBorder.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          // Icon + title
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  gradient: AppColors.buttonGradient,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.person_rounded,
                  color: AppColors.white,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Complete Your Profile',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Add your gender to unlock viewer analytics',
                      style: TextStyle(color: AppColors.hintText, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          // Gender options
          ..._options.map(
            (opt) => GestureDetector(
              onTap: () => setState(() => _selected = opt['value']),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: _selected == opt['value']
                      ? AppColors.orange.withValues(alpha: 0.15)
                      : AppColors.inputFill.withValues(alpha: 0.5),
                  border: Border.all(
                    color: _selected == opt['value']
                        ? AppColors.orange.withValues(alpha: 0.6)
                        : AppColors.inputBorder,
                  ),
                ),
                child: Row(
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _selected == opt['value']
                            ? AppColors.orange
                            : Colors.transparent,
                        border: Border.all(
                          color: _selected == opt['value']
                              ? AppColors.orange
                              : AppColors.inputBorder,
                          width: 2,
                        ),
                      ),
                      child: _selected == opt['value']
                          ? const Icon(
                              Icons.check,
                              color: AppColors.white,
                              size: 12,
                            )
                          : null,
                    ),
                    const SizedBox(width: 14),
                    Text(
                      opt['label']!,
                      style: TextStyle(
                        color: _selected == opt['value']
                            ? AppColors.white
                            : AppColors.hintText,
                        fontSize: 14,
                        fontWeight: _selected == opt['value']
                            ? FontWeight.w600
                            : FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 4),
            Text(
              _error!,
              style: const TextStyle(color: AppColors.errorRed, fontSize: 12),
            ),
          ],
          const SizedBox(height: 8),
          // Save + skip buttons
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      color: AppColors.inputFill,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Center(
                      child: Text(
                        'Skip',
                        style: TextStyle(
                          color: AppColors.hintText,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: GestureDetector(
                  onTap: _selected != null && !_saving ? _save : null,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      gradient: _selected != null
                          ? AppColors.buttonGradient
                          : null,
                      color: _selected == null ? AppColors.inputBorder : null,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Center(
                      child: _saving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.white,
                              ),
                            )
                          : Text(
                              'Save Gender',
                              style: TextStyle(
                                color: _selected != null
                                    ? AppColors.white
                                    : AppColors.hintText,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
