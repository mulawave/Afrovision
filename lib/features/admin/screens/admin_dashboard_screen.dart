import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../services/admin_service.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen>
    with SingleTickerProviderStateMixin {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _dashboard;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  // Sub-sections
  int _activeTab = 0; // 0=overview, 1=users, 2=channels, 3=flags, 4=audit
  List<Map<String, dynamic>> _users = [];
  List<Map<String, dynamic>> _channels = [];
  List<Map<String, dynamic>> _flags = [];
  List<Map<String, dynamic>> _auditLogs = [];
  bool _subLoading = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.04),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _loadDashboard();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadDashboard() async {
    try {
      final data = await AdminService.getDashboard();
      if (!mounted) return;
      setState(() {
        _dashboard = data;
        _loading = false;
      });
      _animController.forward();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _switchTab(int tab) async {
    if (_activeTab == tab) return;
    setState(() {
      _activeTab = tab;
      _subLoading = true;
    });
    try {
      switch (tab) {
        case 1:
          if (_users.isEmpty) _users = await AdminService.getUsers();
          break;
        case 2:
          if (_channels.isEmpty) {
            _channels = await AdminService.getAllChannels();
          }
          break;
        case 3:
          _flags = await AdminService.getFeatureFlags();
          break;
        case 4:
          _auditLogs = await AdminService.getAuditLogs(limit: 100);
          break;
      }
    } catch (e) {
      debugPrint('[AdminDashboard] tab load error: $e');
    }
    if (!mounted) return;
    setState(() => _subLoading = false);
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
                    : _error != null
                    ? Center(
                        child: Text(
                          _error!,
                          style: const TextStyle(
                            color: AppColors.errorRed,
                            fontSize: 14,
                          ),
                        ),
                      )
                    : FadeTransition(
                        opacity: _fadeAnim,
                        child: SlideTransition(
                          position: _slideAnim,
                          child: RefreshIndicator(
                            color: AppColors.orange,
                            backgroundColor: AppColors.inputFill,
                            onRefresh: _loadDashboard,
                            child: SingleChildScrollView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.only(bottom: 40),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 16),
                                  _buildMetricHeroCards(),
                                  const SizedBox(height: 24),
                                  _buildTabBar(),
                                  const SizedBox(height: 16),
                                  _buildTabContent(),
                                ],
                              ),
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

  // ───────── APP BAR ─────────
  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
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
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: AppColors.orange,
                size: 18,
              ),
            ),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Admin Panel',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.3,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Full Control System',
                  style: TextStyle(
                    color: AppColors.hintText,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.orange.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: AppColors.orange.withValues(alpha: 0.3),
              ),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.admin_panel_settings_rounded,
                  color: AppColors.orange,
                  size: 16,
                ),
                SizedBox(width: 4),
                Text(
                  'ADMIN',
                  style: TextStyle(
                    color: AppColors.orange,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ───────── METRIC HERO CARDS ─────────
  Widget _buildMetricHeroCards() {
    final users = _dashboard?['users'] as Map<String, dynamic>? ?? {};
    final channels = _dashboard?['channels'] as Map<String, dynamic>? ?? {};
    final financial = _dashboard?['financial'] as Map<String, dynamic>? ?? {};

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _heroCard(
                  icon: Icons.people_rounded,
                  label: 'Total Users',
                  value: '${users['total'] ?? 0}',
                  color: AppColors.orange,
                  sub:
                      '${users['creators'] ?? 0} creators · ${users['premium'] ?? 0} premium',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _heroCard(
                  icon: Icons.live_tv_rounded,
                  label: 'Channels',
                  value: '${channels['total'] ?? 0}',
                  color: AppColors.lightOrange,
                  sub:
                      '${channels['active'] ?? 0} active · ${channels['disabled'] ?? 0} disabled',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _heroCard(
                  icon: Icons.account_balance_wallet_rounded,
                  label: 'VPT Distributed',
                  value: _formatNum(
                    (financial['total_vpt_distributed'] ?? 0).toDouble(),
                  ),
                  color: AppColors.successGreen,
                  sub: '${financial['total_entries'] ?? 0} ledger entries',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _heroCard(
                  icon: Icons.payments_rounded,
                  label: 'NGN Revenue',
                  value: _formatNaira(
                    (financial['total_ngn_in'] ?? 0).toDouble(),
                  ),
                  color: AppColors.infoBlue,
                  sub:
                      '${financial['pending_withdrawals'] ?? 0} pending withdrawals',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroCard({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
    String? sub,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.2)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 18),
              ),
              const Spacer(),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              color: AppColors.hintText.withValues(alpha: 0.8),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (sub != null) ...[
            const SizedBox(height: 6),
            Text(
              sub,
              style: TextStyle(
                color: AppColors.hintText.withValues(alpha: 0.5),
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ───────── TAB BAR ─────────
  Widget _buildTabBar() {
    const tabs = ['Overview', 'Users', 'Channels', 'Flags', 'Audit'];
    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: tabs.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final active = _activeTab == i;
          return GestureDetector(
            onTap: () => _switchTab(i),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              decoration: BoxDecoration(
                color: active
                    ? AppColors.orange.withValues(alpha: 0.15)
                    : AppColors.inputFill,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: active
                      ? AppColors.orange.withValues(alpha: 0.4)
                      : AppColors.inputBorder,
                ),
              ),
              alignment: Alignment.center,
              child: Text(
                tabs[i],
                style: TextStyle(
                  color: active ? AppColors.orange : AppColors.hintText,
                  fontSize: 13,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ───────── TAB CONTENT ─────────
  Widget _buildTabContent() {
    if (_subLoading) {
      return const Padding(
        padding: EdgeInsets.only(top: 60),
        child: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
          ),
        ),
      );
    }
    switch (_activeTab) {
      case 1:
        return _buildUsersTab();
      case 2:
        return _buildChannelsTab();
      case 3:
        return _buildFlagsTab();
      case 4:
        return _buildAuditTab();
      default:
        return _buildOverviewTab();
    }
  }

  // ───── OVERVIEW TAB ─────
  Widget _buildOverviewTab() {
    final users = _dashboard?['users'] as Map<String, dynamic>? ?? {};
    final channels = _dashboard?['channels'] as Map<String, dynamic>? ?? {};
    final financial = _dashboard?['financial'] as Map<String, dynamic>? ?? {};
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionLabel('USER BREAKDOWN'),
          const SizedBox(height: 10),
          _statRow('Admins', '${users['admins'] ?? 0}'),
          _statRow('Creators', '${users['creators'] ?? 0}'),
          _statRow('Viewers', '${users['viewers'] ?? 0}'),
          _statRow('Premium Creators', '${users['premium'] ?? 0}'),
          const SizedBox(height: 20),
          _sectionLabel('CHANNEL BREAKDOWN'),
          const SizedBox(height: 10),
          _statRow('Public', '${channels['public'] ?? 0}'),
          _statRow('Private', '${channels['private'] ?? 0}'),
          _statRow('Disabled', '${channels['disabled'] ?? 0}'),
          const SizedBox(height: 20),
          _sectionLabel('FINANCIAL'),
          const SizedBox(height: 10),
          _statRow('Gift Wallets', '${financial['gift_wallets'] ?? 0}'),
          _statRow(
            'Gift VPT Pool',
            _formatNum((financial['total_gift_vpt'] ?? 0).toDouble()),
          ),
          _statRow(
            'Gift NGN Pool',
            _formatNaira((financial['total_gift_ngn'] ?? 0).toDouble()),
          ),
          _statRow('Total Swaps', '${financial['total_swaps'] ?? 0}'),
          _statRow('Failed Entries', '${financial['total_failures'] ?? 0}'),
        ],
      ),
    );
  }

  // ───── USERS TAB ─────
  Widget _buildUsersTab() {
    if (_users.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(top: 60),
        child: Center(
          child: Text(
            'No users found',
            style: TextStyle(color: AppColors.hintText, fontSize: 14),
          ),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: _users.map((u) {
          final role = u['role'] as String? ?? 'viewer';
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: _roleColor(role).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    role == 'admin'
                        ? Icons.admin_panel_settings_rounded
                        : role == 'creator'
                        ? Icons.videocam_rounded
                        : Icons.person_rounded,
                    color: _roleColor(role),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        u['name'] as String? ??
                            u['email'] as String? ??
                            'Unknown',
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        u['email'] as String? ?? '',
                        style: TextStyle(
                          color: AppColors.hintText.withValues(alpha: 0.7),
                          fontSize: 11,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: _roleColor(role).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    role.toUpperCase(),
                    style: TextStyle(
                      color: _roleColor(role),
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  // ───── CHANNELS TAB ─────
  Widget _buildChannelsTab() {
    if (_channels.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(top: 60),
        child: Center(
          child: Text(
            'No channels found',
            style: TextStyle(color: AppColors.hintText, fontSize: 14),
          ),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: _channels.map((ch) {
          final active = ch['is_active'] as bool? ?? true;
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: active
                    ? AppColors.inputBorder
                    : AppColors.errorRed.withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: (active ? AppColors.lightOrange : AppColors.errorRed)
                        .withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    active ? Icons.live_tv_rounded : Icons.block_rounded,
                    color: active ? AppColors.lightOrange : AppColors.errorRed,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        ch['name'] as String? ?? 'Unnamed',
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '#${ch['channel_number'] ?? '—'} · ${ch['type'] ?? 'public'}',
                        style: TextStyle(
                          color: AppColors.hintText.withValues(alpha: 0.7),
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () => _toggleChannel(ch),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color:
                          (active ? AppColors.errorRed : AppColors.successGreen)
                              .withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color:
                            (active
                                    ? AppColors.errorRed
                                    : AppColors.successGreen)
                                .withValues(alpha: 0.3),
                      ),
                    ),
                    child: Text(
                      active ? 'DISABLE' : 'ENABLE',
                      style: TextStyle(
                        color: active
                            ? AppColors.errorRed
                            : AppColors.successGreen,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Future<void> _toggleChannel(Map<String, dynamic> ch) async {
    final id = ch['id'] as String;
    final active = ch['is_active'] as bool? ?? true;
    try {
      if (active) {
        await AdminService.disableChannel(id);
      } else {
        await AdminService.enableChannel(id);
      }
      _channels = await AdminService.getAllChannels();
      if (mounted) setState(() {});
    } catch (e) {
      debugPrint('[AdminDashboard] toggle channel error: $e');
    }
  }

  // ───── FLAGS TAB ─────
  Widget _buildFlagsTab() {
    if (_flags.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 60),
        child: Center(
          child: Column(
            children: [
              const Text(
                'No feature flags',
                style: TextStyle(color: AppColors.hintText, fontSize: 14),
              ),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: _addFlag,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.orange.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppColors.orange.withValues(alpha: 0.3),
                    ),
                  ),
                  child: const Text(
                    '+ Add Flag',
                    style: TextStyle(
                      color: AppColors.orange,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: [
          ..._flags.map((f) {
            final enabled = f['enabled'] as bool? ?? false;
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.cardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: Row(
                children: [
                  Icon(
                    enabled
                        ? Icons.toggle_on_rounded
                        : Icons.toggle_off_rounded,
                    color: enabled
                        ? AppColors.successGreen
                        : AppColors.hintText,
                    size: 32,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      f['key'] as String? ?? '',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => _toggleFlag(f),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color:
                            (enabled
                                    ? AppColors.errorRed
                                    : AppColors.successGreen)
                                .withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        enabled ? 'DISABLE' : 'ENABLE',
                        style: TextStyle(
                          color: enabled
                              ? AppColors.errorRed
                              : AppColors.successGreen,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: _addFlag,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.orange.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.orange.withValues(alpha: 0.2),
                ),
              ),
              alignment: Alignment.center,
              child: const Text(
                '+ Add Feature Flag',
                style: TextStyle(
                  color: AppColors.orange,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _toggleFlag(Map<String, dynamic> f) async {
    final key = f['key'] as String;
    final current = f['enabled'] as bool? ?? false;
    try {
      await AdminService.toggleFeatureFlag(key, !current);
      _flags = await AdminService.getFeatureFlags();
      if (mounted) setState(() {});
    } catch (e) {
      debugPrint('[AdminDashboard] toggle flag error: $e');
    }
  }

  Future<void> _addFlag() async {
    final controller = TextEditingController();
    final key = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        title: const Text(
          'New Feature Flag',
          style: TextStyle(color: AppColors.white, fontSize: 16),
        ),
        content: TextField(
          controller: controller,
          style: const TextStyle(color: AppColors.white),
          decoration: InputDecoration(
            hintText: 'flag_key',
            hintStyle: TextStyle(
              color: AppColors.hintText.withValues(alpha: 0.5),
            ),
            enabledBorder: UnderlineInputBorder(
              borderSide: BorderSide(
                color: AppColors.inputBorder.withValues(alpha: 0.5),
              ),
            ),
            focusedBorder: const UnderlineInputBorder(
              borderSide: BorderSide(color: AppColors.orange),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.hintText),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text(
              'Create',
              style: TextStyle(color: AppColors.orange),
            ),
          ),
        ],
      ),
    );
    if (key != null && key.isNotEmpty) {
      try {
        await AdminService.toggleFeatureFlag(key, false);
        _flags = await AdminService.getFeatureFlags();
        if (mounted) setState(() {});
      } catch (e) {
        debugPrint('[AdminDashboard] add flag error: $e');
      }
    }
  }

  // ───── AUDIT TAB ─────
  Widget _buildAuditTab() {
    if (_auditLogs.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(top: 60),
        child: Center(
          child: Text(
            'No audit logs',
            style: TextStyle(color: AppColors.hintText, fontSize: 14),
          ),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: _auditLogs.map((log) {
          final action = log['action'] as String? ?? '';
          final ts = log['timestamp'] as num? ?? 0;
          final date = DateTime.fromMillisecondsSinceEpoch(ts.toInt());
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 2),
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: AppColors.orange.withValues(alpha: 0.6),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        action.replaceAll('_', ' ').toUpperCase(),
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      if (log['target_id'] != null)
                        Text(
                          'Target: ${log['target_id']}',
                          style: TextStyle(
                            color: AppColors.hintText.withValues(alpha: 0.6),
                            fontSize: 10,
                          ),
                        ),
                      Text(
                        '${date.day}/${date.month}/${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}',
                        style: TextStyle(
                          color: AppColors.hintText.withValues(alpha: 0.4),
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  // ───────── HELPERS ─────────
  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: TextStyle(
        color: AppColors.hintText.withValues(alpha: 0.6),
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.2,
      ),
    );
  }

  Widget _statRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: AppColors.hintText.withValues(alpha: 0.7),
              fontSize: 13,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Color _roleColor(String role) {
    switch (role) {
      case 'admin':
        return AppColors.orange;
      case 'creator':
        return AppColors.lightOrange;
      default:
        return AppColors.hintText;
    }
  }

  String _formatNum(double n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toStringAsFixed(n == n.roundToDouble() ? 0 : 2);
  }

  String _formatNaira(double n) {
    final str = n.toStringAsFixed(0);
    final buffer = StringBuffer();
    int count = 0;
    for (int i = str.length - 1; i >= 0; i--) {
      buffer.write(str[i]);
      count++;
      if (count % 3 == 0 && i > 0) buffer.write(',');
    }
    return '₦${buffer.toString().split('').reversed.join()}';
  }
}
