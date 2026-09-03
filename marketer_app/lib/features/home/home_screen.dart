import 'package:flutter/material.dart';
import 'package:afrovision_marketer/core/theme/app_colors.dart';
import 'package:afrovision_marketer/core/widgets/app_logo.dart';
import 'package:afrovision_marketer/core/services/api_service.dart';
import 'package:afrovision_marketer/features/codes/request_code_screen.dart';
import 'package:afrovision_marketer/features/codes/history_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  Map<String, dynamic>? _meData;
  bool _isLoading = true;
  String? _error;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(vsync: this, duration: Duration(milliseconds: 500));
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeIn);
    _loadData();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final data = await ApiService.me();
      if (data['success'] == true) {
        _meData = data;
        _animController.forward();
      } else {
        _error = (data['message'] as String?) ?? (data['error'] as String?) ?? 'Failed to load data';
      }
    } catch (e) {
      _error = 'Network error. Pull to retry.';
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _logout() async {
    await ApiService.logout();
    if (mounted) Navigator.pushNamedAndRemoveUntil(context, '/', (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: _loadData,
            color: AppColors.orange,
            child: _isLoading
                ? Center(child: CircularProgressIndicator(color: AppColors.orange))
                : _error != null
                    ? ListView(
                        children: [
                          SizedBox(height: 200),
                          Center(
                            child: Container(
                              margin: EdgeInsets.symmetric(horizontal: 28),
                              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              decoration: BoxDecoration(
                                color: AppColors.errorRed.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.3)),
                              ),
                              child: Text(_error!, style: TextStyle(color: AppColors.errorRed, fontSize: 13), textAlign: TextAlign.center),
                            ),
                          ),
                          SizedBox(height: 16),
                          Center(
                            child: TextButton(
                              onPressed: _loadData,
                              child: Text('Retry', style: TextStyle(color: AppColors.orange)),
                            ),
                          ),
                        ],
                      )
                    : FadeTransition(
                        opacity: _fadeAnim,
                        child: ListView(
                          padding: EdgeInsets.symmetric(horizontal: 24, vertical: 24),
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                AppLogo(size: 40),
                                IconButton(
                                  onPressed: _logout,
                                  icon: Icon(Icons.logout, color: AppColors.lightOrange, size: 22),
                                ),
                              ],
                            ),
                            SizedBox(height: 32),
                            _buildGreeting(),
                            SizedBox(height: 24),
                            _buildStatsGrid(),
                            SizedBox(height: 28),
                            _buildActionCard(
                              icon: Icons.qr_code_2,
                              title: 'Request Activation Code',
                              subtitle: 'Get a fresh code for a new TV activation',
                              onTap: () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => RequestCodeScreen()),
                                );
                                _loadData();
                              },
                            ),
                            SizedBox(height: 14),
                            _buildActionCard(
                              icon: Icons.history,
                              title: 'Code History',
                              subtitle: 'View all codes you\'ve requested',
                              onTap: () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => HistoryScreen()),
                                );
                                _loadData();
                              },
                            ),
                            SizedBox(height: 28),
                            _buildDistributorCard(),
                          ],
                        ),
                      ),
          ),
        ),
      ),
    );
  }

  Widget _buildGreeting() {
    final marketer = _meData?['marketer'] as Map<String, dynamic>?;
    final name = marketer?['name'] as String? ?? 'Marketer';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Welcome back,', style: TextStyle(color: AppColors.lightOrange, fontSize: 13)),
        SizedBox(height: 4),
        Text(name, style: TextStyle(color: AppColors.white, fontSize: 24, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildStatsGrid() {
    final distributor = _meData?['distributor'] as Map<String, dynamic>?;
    final marketer = _meData?['marketer'] as Map<String, dynamic>?;
    final quotaRemaining = distributor?['quota_remaining'] ?? 0;
    final quotaTotal = distributor?['quota_total'] ?? 0;
    final codesRequested = marketer?['codes_requested'] ?? 0;
    final activationCount = marketer?['activation_count'] ?? 0;
    final licenseValid = distributor?['license_valid'] ?? false;

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.3,
      children: [
        _statCard('Quota Remaining', '$quotaRemaining', 'of $quotaTotal', AppColors.orange),
        _statCard('Codes Requested', '$codesRequested', 'all time', AppColors.lightOrange),
        _statCard('Activations', '$activationCount', 'successful', AppColors.successGreen),
        _statCard('License', licenseValid ? 'Valid' : 'Expired', licenseValid ? 'active' : 'contact admin', licenseValid ? AppColors.successGreen : AppColors.errorRed),
      ],
    );
  }

  Widget _statCard(String label, String value, String sub, Color accent) {
    return Container(
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: AppColors.lightOrange.withValues(alpha: 0.7), fontSize: 11, fontWeight: FontWeight.w600)),
          Spacer(),
          Text(value, style: TextStyle(color: accent, fontSize: 28, fontWeight: FontWeight.bold)),
          SizedBox(height: 2),
          Text(sub, style: TextStyle(color: AppColors.hintText, fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildActionCard({required IconData icon, required String title, required String subtitle, required VoidCallback onTap}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.5)),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: AppColors.buttonGradient,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: AppColors.darkBlue, size: 24),
              ),
              SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: TextStyle(color: AppColors.white, fontSize: 15, fontWeight: FontWeight.bold)),
                    SizedBox(height: 2),
                    Text(subtitle, style: TextStyle(color: AppColors.hintText, fontSize: 12)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: AppColors.hintText, size: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDistributorCard() {
    final distributor = _meData?['distributor'] as Map<String, dynamic>?;
    if (distributor == null) return SizedBox.shrink();
    final companyName = distributor['company_name'] as String? ?? 'Unknown';
    final licenseExpires = distributor['license_expires_at'] as String?;
    final status = distributor['status'] as String? ?? 'active';

    return Container(
      padding: EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Your Distributor', style: TextStyle(color: AppColors.lightOrange.withValues(alpha: 0.7), fontSize: 11, fontWeight: FontWeight.w600)),
          SizedBox(height: 10),
          Row(
            children: [
              Icon(Icons.business, color: AppColors.orange, size: 20),
              SizedBox(width: 10),
              Expanded(child: Text(companyName, style: TextStyle(color: AppColors.white, fontSize: 16, fontWeight: FontWeight.bold))),
            ],
          ),
          SizedBox(height: 12),
          Row(
            children: [
              _distributorChip('Status: $status', status == 'active' ? AppColors.successGreen : AppColors.errorRed),
              SizedBox(width: 8),
              if (licenseExpires != null)
                _distributorChip('Expires: ${_formatDate(licenseExpires)}', AppColors.lightOrange),
            ],
          ),
        ],
      ),
    );
  }

  Widget _distributorChip(String text, Color color) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(text, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w500)),
    );
  }

  String _formatDate(String iso) {
    try {
      final d = DateTime.parse(iso);
      return '${d.day}/${d.month}/${d.year}';
    } catch (_) {
      return iso;
    }
  }
}
