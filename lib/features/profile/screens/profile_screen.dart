import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/role_badge.dart';
import '../../auth/models/user_model.dart';
import '../../auth/services/profile_service.dart';
import '../../auth/services/auth_service.dart';
import '../../currency/models/currency_model.dart';
import '../../currency/currency_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  UserModel? _user;
  bool _loading = true;
  List<CurrencyModel> _currencies = [];
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _loadProfile();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final results = await Future.wait([
        ProfileService.getProfile(),
        CurrencyService.getCurrencies(),
      ]);
      if (!mounted) return;
      setState(() {
        _user = results[0] as UserModel;
        _currencies = results[1] as List<CurrencyModel>;
        _loading = false;
      });
      _animController.forward();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    await AuthService.logout();
    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
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
              _buildAppBar(),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.orange,
                          ),
                        ),
                      )
                    : _user == null
                    ? _buildError()
                    : _buildContent(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context, true),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: AppColors.white,
                size: 18,
              ),
            ),
          ),
          const SizedBox(width: 16),
          const Text(
            'Profile',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Spacer(),
          GestureDetector(
            onTap: () async {
              final result = await Navigator.pushNamed(
                context,
                '/edit-profile',
              );
              if (result == true) _loadProfile();
            },
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.edit_rounded,
                color: AppColors.orange,
                size: 18,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.error_outline_rounded,
            color: AppColors.errorRed,
            size: 48,
          ),
          const SizedBox(height: 12),
          const Text(
            'Failed to load profile',
            style: TextStyle(color: AppColors.white, fontSize: 16),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: () {
              setState(() => _loading = true);
              _loadProfile();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
              decoration: BoxDecoration(
                gradient: AppColors.buttonGradient,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'Retry',
                style: TextStyle(
                  color: AppColors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    final user = _user!;
    return RefreshIndicator(
      color: AppColors.orange,
      backgroundColor: AppColors.inputFill,
      onRefresh: _loadProfile,
      child: FadeTransition(
        opacity: _fadeAnim,
        child: SlideTransition(
          position: _slideAnim,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                const SizedBox(height: 16),
                // Avatar
                Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient:
                        (user.avatarUrl == null || user.avatarUrl!.isEmpty)
                        ? LinearGradient(
                            colors: [
                              AppColors.orange.withValues(alpha: 0.3),
                              AppColors.lightOrange.withValues(alpha: 0.15),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          )
                        : null,
                    border: Border.all(
                      color: AppColors.orange.withValues(alpha: 0.5),
                      width: 2,
                    ),
                    image:
                        (user.avatarUrl != null && user.avatarUrl!.isNotEmpty)
                        ? DecorationImage(
                            image: NetworkImage(user.avatarUrl!),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child: (user.avatarUrl == null || user.avatarUrl!.isEmpty)
                      ? Center(
                          child: Text(
                            _avatarInitials(user),
                            style: const TextStyle(
                              color: AppColors.orange,
                              fontSize: 32,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        )
                      : null,
                ),
                const SizedBox(height: 16),
                // Name
                Text(
                  user.name ?? 'No name set',
                  style: TextStyle(
                    color: user.name != null
                        ? AppColors.white
                        : AppColors.hintText,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  user.email,
                  style: TextStyle(color: AppColors.white, fontSize: 14),
                ),
                const SizedBox(height: 12),
                RoleBadge(
                  role: user.role,
                  isPremiumCreator: user.isPremiumCreator,
                  subscriptionPlan: user.subscriptionPlan,
                ),
                const SizedBox(height: 28),

                // Info cards
                _buildInfoCard(
                  icon: Icons.email_rounded,
                  label: 'Email',
                  value: user.email,
                ),
                _buildInfoCard(
                  icon: Icons.person_rounded,
                  label: 'Name',
                  value: user.name ?? 'Not set',
                ),
                _buildInfoCard(
                  icon: Icons.workspace_premium_rounded,
                  label: 'Premium Creator',
                  value: user.isPremiumCreator ? 'Yes' : 'No',
                  valueColor: user.isPremiumCreator ? AppColors.orange : null,
                ),
                GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/kyc'),
                  child: _buildInfoCard(
                    icon: Icons.verified_user_rounded,
                    label: 'KYC Status',
                    value: user.kycStatus.toUpperCase(),
                    valueColor: _kycColor(user.kycStatus),
                  ),
                ),
                _buildInfoCard(
                  icon: Icons.calendar_today_rounded,
                  label: 'Member Since',
                  value: _formatDate(user.createdAt),
                ),

                // Subscription info cards
                _buildInfoCard(
                  icon: Icons.card_membership_rounded,
                  label: 'Subscription Plan',
                  value: user.subscriptionPlanDisplay,
                  valueColor: user.hasActiveSubscription
                      ? AppColors.orange
                      : null,
                ),
                _buildInfoCard(
                  icon: Icons.power_settings_new_rounded,
                  label: 'Subscription Status',
                  value: user.subscriptionStatus.toUpperCase(),
                  valueColor: user.hasActiveSubscription
                      ? const Color(0xFF4CAF50)
                      : AppColors.hintText,
                ),
                if (user.subscriptionExpiry != null)
                  _buildInfoCard(
                    icon: Icons.timer_rounded,
                    label: 'Expiry Date',
                    value: _formatDate(user.subscriptionExpiry!),
                  ),

                const SizedBox(height: 24),

                // vPT Balance card
                if (user.isCreator) _buildVptBalanceCard(user),

                // Currency preference
                if (_currencies.isNotEmpty) _buildCurrencySelector(user),

                const SizedBox(height: 16),

                // View Plans button (for viewers or those wanting to change plan)
                if (user.isViewer || !user.hasActiveSubscription) ...[
                  GestureDetector(
                    onTap: () async {
                      final result = await Navigator.pushNamed(
                        context,
                        '/plans',
                      );
                      if (result == true) _loadProfile();
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      decoration: BoxDecoration(
                        gradient: AppColors.buttonGradient,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.diamond_rounded,
                            color: AppColors.white,
                            size: 20,
                          ),
                          SizedBox(width: 8),
                          Text(
                            'View Plans',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ] else ...[
                  GestureDetector(
                    onTap: () async {
                      final result = await Navigator.pushNamed(
                        context,
                        '/plans',
                      );
                      if (result == true) _loadProfile();
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      decoration: BoxDecoration(
                        color: AppColors.inputFill,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: AppColors.orange.withValues(alpha: 0.3),
                        ),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.swap_horiz_rounded,
                            color: AppColors.orange,
                            size: 20,
                          ),
                          SizedBox(width: 8),
                          Text(
                            'Change Plan',
                            style: TextStyle(
                              color: AppColors.orange,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // Creator Studio button (for creators)
                if (user.role == 'creator') ...[
                  GestureDetector(
                    onTap: () =>
                        Navigator.pushNamed(context, '/creator-studio'),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      decoration: BoxDecoration(
                        color: AppColors.inputFill,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: AppColors.lightOrange.withValues(alpha: 0.3),
                        ),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.video_settings_rounded,
                            color: AppColors.lightOrange,
                            size: 20,
                          ),
                          SizedBox(width: 8),
                          Text(
                            'Creator Studio',
                            style: TextStyle(
                              color: AppColors.lightOrange,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // Delete Account button
                GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/delete-account'),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    decoration: BoxDecoration(
                      color: AppColors.errorRed.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: AppColors.errorRed.withValues(alpha: 0.2),
                      ),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.delete_forever_rounded,
                          color: AppColors.errorRed,
                          size: 20,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Delete Account',
                          style: TextStyle(
                            color: AppColors.errorRed,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Logout button
                GestureDetector(
                  onTap: _logout,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    decoration: BoxDecoration(
                      color: AppColors.errorRed.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: AppColors.errorRed.withValues(alpha: 0.3),
                      ),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.logout_rounded,
                          color: AppColors.errorRed,
                          size: 20,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Logout',
                          style: TextStyle(
                            color: AppColors.errorRed,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildVptBalanceCard(UserModel user) {
    final hasEnough = user.vptBalance >= 500;
    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/digital-assets'),
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.inputFill,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: hasEnough
                ? const Color(0xFF4CAF50).withValues(alpha: 0.3)
                : AppColors.orange.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.orange.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.account_balance_wallet_rounded,
                color: AppColors.orange,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'vPT Balance',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${_formatVpt(user.vptBalance)} vPT',
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    '≈ ₦${_formatVpt(user.vptBalance * 750)}',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: hasEnough
                    ? const Color(0xFF4CAF50).withValues(alpha: 0.1)
                    : AppColors.errorRed.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                hasEnough ? 'Edit Ready' : 'Low',
                style: TextStyle(
                  color: hasEnough
                      ? const Color(0xFF4CAF50)
                      : AppColors.errorRed,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatVpt(double amount) {
    final intAmount = amount.toInt();
    if (intAmount >= 1000) {
      final str = intAmount.toString();
      final buffer = StringBuffer();
      for (int i = 0; i < str.length; i++) {
        if (i > 0 && (str.length - i) % 3 == 0) buffer.write(',');
        buffer.write(str[i]);
      }
      return buffer.toString();
    }
    return intAmount.toString();
  }

  Widget _buildCurrencySelector(UserModel user) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.currency_exchange_rounded,
              color: AppColors.orange,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Preferred Currency',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.lightBlue.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: AppColors.orange.withValues(alpha: 0.3),
              ),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: user.preferredCurrency,
                dropdownColor: AppColors.lightBlue,
                icon: const Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: AppColors.orange,
                  size: 18,
                ),
                isDense: true,
                style: const TextStyle(
                  color: AppColors.orange,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
                items: _currencies.map((c) {
                  return DropdownMenuItem(
                    value: c.code,
                    child: Text('${c.symbol} ${c.code}'),
                  );
                }).toList(),
                onChanged: (code) async {
                  if (code == null || code == user.preferredCurrency) return;
                  try {
                    await CurrencyService.updatePreferredCurrency(code);
                    _loadProfile();
                  } catch (e) {
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          e.toString(),
                          style: const TextStyle(color: AppColors.white),
                        ),
                        backgroundColor: AppColors.errorRed.withValues(
                          alpha: 0.9,
                        ),
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    );
                  }
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard({
    required IconData icon,
    required String label,
    required String value,
    Color? valueColor,
  }) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.orange, size: 18),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    color: AppColors.lightOrange,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  value,
                  style: TextStyle(
                    color: valueColor ?? AppColors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _avatarInitials(UserModel user) {
    if (user.name != null && user.name!.isNotEmpty) {
      final parts = user.name!.trim().split(' ');
      if (parts.length >= 2) {
        return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
      }
      return parts[0][0].toUpperCase();
    }
    return user.email[0].toUpperCase();
  }

  Color _kycColor(String status) {
    switch (status) {
      case 'verified':
        return const Color(0xFF4CAF50);
      case 'pending':
        return AppColors.lightOrange;
      default:
        return AppColors.hintText;
    }
  }

  String _formatDate(String isoDate) {
    final date = DateTime.tryParse(isoDate);
    if (date == null) return isoDate;
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${months[date.month - 1]} ${date.day}, ${date.year}';
  }
}
