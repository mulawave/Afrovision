import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/app_button.dart';
import '../services/channel_service.dart';

class ChannelNumberAccessScreen extends StatefulWidget {
  const ChannelNumberAccessScreen({super.key});

  @override
  State<ChannelNumberAccessScreen> createState() =>
      _ChannelNumberAccessScreenState();
}

class _ChannelNumberAccessScreenState extends State<ChannelNumberAccessScreen>
    with SingleTickerProviderStateMixin {
  final _numberController = TextEditingController();
  bool _loading = false;
  String? _error;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _animController.forward();
  }

  @override
  void dispose() {
    _numberController.dispose();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _access() async {
    final number = _numberController.text.trim();
    if (number.isEmpty) {
      setState(() => _error = 'Enter a channel number');
      return;
    }
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final channel = await ChannelService.getChannelByNumber(number);
      if (!mounted) return;
      Navigator.pushNamed(context, '/channel-view', arguments: channel.id);
      setState(() => _loading = false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.inputFill,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.inputBorder),
                        ),
                        child: const Icon(Icons.arrow_back_ios_new_rounded,
                            color: AppColors.white, size: 18),
                      ),
                    ),
                    const SizedBox(width: 16),
                    const Text(
                      'Access Channel',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: FadeTransition(
                  opacity: _fadeAnim,
                  child: SlideTransition(
                    position: _slideAnim,
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Column(
                        children: [
                          const SizedBox(height: 40),
                          // Lock icon
                          Container(
                            width: 80,
                            height: 80,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: LinearGradient(
                                colors: [
                                  AppColors.orange.withValues(alpha: 0.25),
                                  AppColors.lightOrange
                                      .withValues(alpha: 0.1),
                                ],
                              ),
                              border: Border.all(
                                  color:
                                      AppColors.orange.withValues(alpha: 0.4),
                                  width: 2),
                            ),
                            child: const Icon(Icons.dialpad_rounded,
                                color: AppColors.orange, size: 36),
                          ),
                          const SizedBox(height: 20),
                          const Text(
                            'Enter Channel Number',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Access private and public channels by number',
                            style: TextStyle(
                              color: AppColors.hintText.withValues(alpha: 0.7),
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 36),

                          AppTextField(
                            controller: _numberController,
                            label: 'CHANNEL NUMBER',
                            hint: 'e.g. 839271',
                            prefixIcon: Icons.tag_rounded,
                            keyboardType: TextInputType.number,
                            errorText: _error,
                            onChanged: (_) {
                              if (_error != null) {
                                setState(() => _error = null);
                              }
                            },
                          ),
                          const SizedBox(height: 28),

                          AppButton(
                            label: 'Access Channel',
                            onPressed: _access,
                            loading: _loading,
                            enabled: !_loading,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
