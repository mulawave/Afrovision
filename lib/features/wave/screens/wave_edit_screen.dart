import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../models/wave_model.dart';
import '../services/wave_service.dart';

class WaveEditScreen extends StatefulWidget {
  const WaveEditScreen({super.key});

  @override
  State<WaveEditScreen> createState() => _WaveEditScreenState();
}

class _WaveEditScreenState extends State<WaveEditScreen> {
  final TextEditingController _titleCtrl = TextEditingController();
  final TextEditingController _descriptionCtrl = TextEditingController();

  WaveModel? _wave;
  String _ageClassification = 'teen';
  bool _hasExplicitLanguage = false;
  bool _hasNudity = false;
  bool _hasViolence = false;
  bool _saving = false;
  bool _argsHandled = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_argsHandled) return;
    _argsHandled = true;

    final args = ModalRoute.of(context)?.settings.arguments;
    WaveModel? wave;
    if (args is WaveModel) {
      wave = args;
    } else if (args is Map) {
      final mapped = args['wave'];
      if (mapped is WaveModel) {
        wave = mapped;
      }
    }

    if (wave == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        Navigator.pop(context);
      });
      return;
    }

    _wave = wave;
    _titleCtrl.text = wave.title;
    _descriptionCtrl.text = wave.description;
    _ageClassification = wave.ageClassification;
    _hasExplicitLanguage = wave.hasExplicitLanguage;
    _hasNudity = wave.hasNudity;
    _hasViolence = wave.hasViolence;
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descriptionCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final wave = _wave;
    if (wave == null) return;
    final title = _titleCtrl.text.trim();
    final description = _descriptionCtrl.text.trim();

    if (title.isEmpty) {
      _showSnack('Title is required.');
      return;
    }

    setState(() {
      _saving = true;
    });

    try {
      final updated = await WaveService.updateWave(
        waveId: wave.id,
        title: title,
        description: description,
        ageClassification: _ageClassification,
        hasExplicitLanguage: _hasExplicitLanguage,
        hasNudity: _hasNudity,
        hasViolence: _hasViolence,
        thumbnailUrl: wave.thumbnailUrl,
      );

      if (!mounted) return;
      Navigator.pop(context, updated);
    } catch (e) {
      if (!mounted) return;
      _showSnack(e.toString());
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final wave = _wave;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: wave == null
              ? const Center(
                  child: CircularProgressIndicator(color: AppColors.orange),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          IconButton(
                            onPressed: () => Navigator.pop(context),
                            icon: const Icon(Icons.arrow_back_ios_new_rounded),
                            color: AppColors.white,
                            style: IconButton.styleFrom(
                              backgroundColor: AppColors.inputFill,
                              side: const BorderSide(
                                color: AppColors.inputBorder,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Text(
                              'Edit Wave',
                              style: TextStyle(
                                color: AppColors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _sectionCard(
                        title: 'Current Video',
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              wave.title,
                              style: const TextStyle(
                                color: AppColors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              wave.channelName,
                              style: const TextStyle(
                                color: AppColors.hintText,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Video replacement is not enabled here. You can edit metadata and visibility.',
                              style: const TextStyle(
                                color: AppColors.hintText,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      _sectionCard(
                        title: 'Details',
                        child: Column(
                          children: [
                            TextField(
                              controller: _titleCtrl,
                              enabled: !_saving,
                              maxLength: 120,
                              style: const TextStyle(color: AppColors.white),
                              decoration: _inputDecoration(
                                'Wave title',
                              ).copyWith(counterText: ''),
                            ),
                            const SizedBox(height: 10),
                            TextField(
                              controller: _descriptionCtrl,
                              enabled: !_saving,
                              maxLength: 500,
                              maxLines: 4,
                              style: const TextStyle(color: AppColors.white),
                              decoration: _inputDecoration(
                                'Description',
                              ).copyWith(counterText: ''),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      _sectionCard(
                        title: 'Safety Classification',
                        child: Column(
                          children: [
                            DropdownButtonFormField<String>(
                              initialValue: _ageClassification,
                              dropdownColor: AppColors.cardBg,
                              items: const [
                                DropdownMenuItem(
                                  value: 'minor_safe',
                                  child: Text('Minor Safe'),
                                ),
                                DropdownMenuItem(
                                  value: 'teen',
                                  child: Text('Teen'),
                                ),
                                DropdownMenuItem(
                                  value: 'adult',
                                  child: Text('Adult 18+'),
                                ),
                              ],
                              onChanged: _saving
                                  ? null
                                  : (value) {
                                      if (value == null) return;
                                      setState(() {
                                        _ageClassification = value;
                                      });
                                    },
                              decoration: _inputDecoration(
                                'Age classification',
                              ),
                            ),
                            const SizedBox(height: 10),
                            _flagTile(
                              label: 'Contains explicit language',
                              value: _hasExplicitLanguage,
                              onChanged: (value) =>
                                  setState(() => _hasExplicitLanguage = value),
                            ),
                            _flagTile(
                              label: 'Contains nudity',
                              value: _hasNudity,
                              onChanged: (value) =>
                                  setState(() => _hasNudity = value),
                            ),
                            _flagTile(
                              label: 'Contains violence',
                              value: _hasViolence,
                              onChanged: (value) =>
                                  setState(() => _hasViolence = value),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      AppButton(
                        label: _saving ? 'Saving...' : 'Save Wave Changes',
                        loading: _saving,
                        onPressed: _saving ? null : _save,
                      ),
                    ],
                  ),
                ),
        ),
      ),
    );
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: AppColors.lightOrange,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Widget _flagTile({
    required String label,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return SwitchListTile.adaptive(
      contentPadding: EdgeInsets.zero,
      title: Text(
        label,
        style: const TextStyle(color: AppColors.white, fontSize: 13),
      ),
      value: value,
      activeThumbColor: AppColors.orange,
      activeTrackColor: AppColors.orange.withValues(alpha: 0.35),
      onChanged: _saving ? null : onChanged,
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: AppColors.hintText),
      filled: true,
      fillColor: AppColors.cardBg.withValues(alpha: 0.9),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.inputBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.orange),
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.inputBorder),
      ),
    );
  }
}
