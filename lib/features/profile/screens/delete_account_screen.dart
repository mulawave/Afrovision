import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/api/api_service.dart';
import '../../auth/services/auth_service.dart';

class DeleteAccountScreen extends StatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  State<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends State<DeleteAccountScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  bool _loading = true;
  bool _submitting = false;
  bool _cancelling = false;
  bool _deleting = false;
  bool _showConfirm = false;

  String? _error;
  String? _success;

  // Pending request
  Map<String, dynamic>? _pendingRequest;

  // Form state
  String _selectedReason = '';
  final _feedbackCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  static const _reasons = [
    'I no longer use AfroVision',
    'I have privacy concerns',
    'I found a better alternative',
    'I have multiple accounts',
    "I'm not satisfied with the service",
    'Other',
  ];

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeAnim = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _checkStatus();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _feedbackCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkStatus() async {
    setState(() => _loading = true);
    try {
      final data = await AuthService.getDeletionStatus();
      if (data['has_pending_request'] == true && data['request'] != null) {
        _pendingRequest = data['request'] as Map<String, dynamic>;
      }
    } on ApiException catch (_) {
      // No pending request
    }
    if (mounted) {
      setState(() => _loading = false);
      _animCtrl.forward();
    }
  }

  Future<void> _submitRequest() async {
    if (_selectedReason.isEmpty) {
      setState(() => _error = 'Please select a reason');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _success = null;
    });
    try {
      final data = await AuthService.requestAccountDeletion(
        _selectedReason,
        _feedbackCtrl.text.trim(),
      );
      if (mounted) {
        setState(() {
          _pendingRequest = data['request'] as Map<String, dynamic>?;
          _success = data['message'] as String?;
          _submitting = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _submitting = false;
        });
      }
    }
  }

  Future<void> _cancelDeletion() async {
    setState(() {
      _cancelling = true;
      _error = null;
    });
    try {
      await AuthService.cancelAccountDeletion();
      if (mounted) {
        setState(() {
          _pendingRequest = null;
          _success = 'Deletion request cancelled. Your account is safe.';
          _cancelling = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _cancelling = false;
        });
      }
    }
  }

  Future<void> _immediateDelete() async {
    if (_confirmCtrl.text != 'DELETE MY ACCOUNT') {
      setState(() => _error = 'Please type "DELETE MY ACCOUNT" to confirm');
      return;
    }
    if (_passwordCtrl.text.isEmpty) {
      setState(() => _error = 'Password is required');
      return;
    }
    setState(() {
      _deleting = true;
      _error = null;
    });
    try {
      await AuthService.confirmImmediateDeletion(_passwordCtrl.text);
      await AuthService.logout();
      if (mounted) {
        Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _deleting = false;
        });
      }
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
              _buildAppBar(),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.orange,
                          strokeWidth: 2,
                        ),
                      )
                    : FadeTransition(
                        opacity: _fadeAnim,
                        child: SlideTransition(
                          position: _slideAnim,
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.symmetric(horizontal: 24),
                            child: _pendingRequest != null
                                ? _buildPendingView()
                                : _buildRequestForm(),
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

  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 24, 0),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(
              Icons.arrow_back_ios_new_rounded,
              color: AppColors.white,
              size: 20,
            ),
          ),
          const Text(
            'Delete Account',
            style: TextStyle(
              color: AppColors.errorRed,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  // ── Pending Deletion View ──────────────────────────────

  Widget _buildPendingView() {
    final scheduledAt = _pendingRequest!['scheduled_deletion_at'] as num;
    final date = DateTime.fromMillisecondsSinceEpoch(scheduledAt.toInt());
    final formatted = '${date.day} ${_monthName(date.month)} ${date.year}';
    final graceDays = _pendingRequest!['grace_period_days'] ?? 30;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),

        // Status banner
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.orange.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.orange.withValues(alpha: 0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: AppColors.orange,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.orange.withValues(alpha: 0.5),
                          blurRadius: 8,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Deletion Scheduled',
                    style: TextStyle(
                      color: AppColors.orange,
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                'Your account is scheduled for permanent deletion on $formatted.',
                style: TextStyle(
                  color: AppColors.lightOrange.withValues(alpha: 0.85),
                  fontSize: 14,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'You have $graceDays days to cancel this request.',
                style: TextStyle(
                  color: AppColors.lightOrange.withValues(alpha: 0.85),
                  fontSize: 14,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // What gets deleted
        _buildInfoCard(),

        if (_error != null) ...[
          const SizedBox(height: 16),
          _buildErrorBanner(_error!),
        ],
        if (_success != null) ...[
          const SizedBox(height: 16),
          _buildSuccessBanner(_success!),
        ],

        const SizedBox(height: 24),

        // Cancel button (primary)
        GestureDetector(
          onTap: _cancelling ? null : _cancelDeletion,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.orange, AppColors.lightOrange],
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(
              child: Text(
                _cancelling
                    ? 'Cancelling...'
                    : 'Cancel Deletion — Keep My Account',
                style: const TextStyle(
                  color: AppColors.darkBlue,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),

        // Delete now button (danger)
        GestureDetector(
          onTap: () => setState(() => _showConfirm = true),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 16),
            decoration: BoxDecoration(
              color: AppColors.errorRed.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppColors.errorRed.withValues(alpha: 0.3),
              ),
            ),
            child: const Center(
              child: Text(
                'Delete Now',
                style: TextStyle(
                  color: AppColors.errorRed,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),

        // Immediate deletion confirm section
        if (_showConfirm) ...[
          const SizedBox(height: 24),
          _buildImmediateConfirm(),
        ],

        const SizedBox(height: 40),
      ],
    );
  }

  // ── Request Form View ──────────────────────────────────

  Widget _buildRequestForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),

        // Warning banner
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.errorRed.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppColors.errorRed.withValues(alpha: 0.3),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '⚠  Before you continue',
                style: TextStyle(
                  color: AppColors.errorRed,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              _warningItem(
                'Your account will be permanently deleted after a 30-day grace period',
              ),
              _warningItem(
                'All your data, channels, content, and balances will be removed',
              ),
              _warningItem('Active subscriptions will not be refunded'),
              _warningItem(
                'You can cancel the request anytime within the grace period',
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Reason selection
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.inputFill,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppColors.lightBlue.withValues(alpha: 0.3),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Why are you leaving?',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 14),
              ..._reasons.map((r) => _buildReasonTile(r)),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Feedback
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.inputFill,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppColors.lightBlue.withValues(alpha: 0.3),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Additional feedback (optional)',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _feedbackCtrl,
                maxLines: 4,
                maxLength: 1000,
                style: const TextStyle(color: AppColors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Tell us how we can improve...',
                  hintStyle: TextStyle(
                    color: AppColors.lightOrange.withValues(alpha: 0.4),
                    fontSize: 14,
                  ),
                  filled: true,
                  fillColor: AppColors.darkBlue.withValues(alpha: 0.4),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: AppColors.lightBlue.withValues(alpha: 0.3),
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: AppColors.lightBlue.withValues(alpha: 0.3),
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: AppColors.orange.withValues(alpha: 0.6),
                    ),
                  ),
                  counterStyle: TextStyle(
                    color: AppColors.lightOrange.withValues(alpha: 0.5),
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
        ),

        if (_error != null) ...[
          const SizedBox(height: 16),
          _buildErrorBanner(_error!),
        ],
        if (_success != null) ...[
          const SizedBox(height: 16),
          _buildSuccessBanner(_success!),
        ],

        const SizedBox(height: 24),

        // Buttons
        Row(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    color: AppColors.inputFill,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: AppColors.lightBlue.withValues(alpha: 0.3),
                    ),
                  ),
                  child: const Center(
                    child: Text(
                      'Go Back',
                      style: TextStyle(
                        color: AppColors.white,
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
              child: GestureDetector(
                onTap: _submitting ? null : _submitRequest,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    color: _selectedReason.isNotEmpty
                        ? AppColors.errorRed.withValues(alpha: 0.12)
                        : AppColors.errorRed.withValues(alpha: 0.04),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: _selectedReason.isNotEmpty
                          ? AppColors.errorRed.withValues(alpha: 0.4)
                          : AppColors.errorRed.withValues(alpha: 0.15),
                    ),
                  ),
                  child: Center(
                    child: Text(
                      _submitting ? 'Submitting...' : 'Request Deletion',
                      style: TextStyle(
                        color: _selectedReason.isNotEmpty
                            ? AppColors.errorRed
                            : AppColors.errorRed.withValues(alpha: 0.4),
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
        const SizedBox(height: 40),
      ],
    );
  }

  // ── Immediate Confirm Section ──────────────────────────

  Widget _buildImmediateConfirm() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.errorRed.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Confirm Immediate Deletion',
            style: TextStyle(
              color: AppColors.errorRed,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'This will permanently delete your account right now. This cannot be undone.',
            style: TextStyle(
              color: AppColors.lightOrange.withValues(alpha: 0.85),
              fontSize: 13,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 16),

          // Confirm text field
          Text(
            'Type "DELETE MY ACCOUNT" to confirm',
            style: TextStyle(
              color: AppColors.lightOrange.withValues(alpha: 0.7),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _confirmCtrl,
            style: const TextStyle(color: AppColors.white, fontSize: 14),
            decoration: _inputDecoration('DELETE MY ACCOUNT'),
          ),
          const SizedBox(height: 16),

          // Password field
          Text(
            'Enter your password',
            style: TextStyle(
              color: AppColors.lightOrange.withValues(alpha: 0.7),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _passwordCtrl,
            obscureText: true,
            style: const TextStyle(color: AppColors.white, fontSize: 14),
            decoration: _inputDecoration('Your account password'),
          ),
          const SizedBox(height: 20),

          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() {
                    _showConfirm = false;
                    _passwordCtrl.clear();
                    _confirmCtrl.clear();
                  }),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      color: AppColors.inputFill,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.lightBlue.withValues(alpha: 0.3),
                      ),
                    ),
                    child: const Center(
                      child: Text(
                        'Go Back',
                        style: TextStyle(
                          color: AppColors.white,
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
                child: GestureDetector(
                  onTap: _deleting ? null : _immediateDelete,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      color: AppColors.errorRed,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        _deleting ? 'Deleting...' : 'Permanently Delete',
                        style: const TextStyle(
                          color: AppColors.white,
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

  // ── Shared Helpers ─────────────────────────────────────

  Widget _buildInfoCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.inputFill,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.lightBlue.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'What will be deleted:',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          _deleteItem('Your profile and personal information'),
          _deleteItem('All channels you own (will be disabled)'),
          _deleteItem('VPT balance and transaction history'),
          _deleteItem('Subscriptions and creator earnings'),
          _deleteItem('All uploaded content and media'),
        ],
      ),
    );
  }

  Widget _deleteItem(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.close_rounded, color: AppColors.errorRed, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: AppColors.lightOrange.withValues(alpha: 0.85),
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _warningItem(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '•',
            style: TextStyle(
              color: AppColors.lightOrange.withValues(alpha: 0.7),
              fontSize: 14,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: AppColors.lightOrange.withValues(alpha: 0.85),
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReasonTile(String reason) {
    final selected = _selectedReason == reason;
    return GestureDetector(
      onTap: () => setState(() => _selectedReason = reason),
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.errorRed.withValues(alpha: 0.08)
              : AppColors.darkBlue.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected
                ? AppColors.errorRed.withValues(alpha: 0.4)
                : AppColors.lightBlue.withValues(alpha: 0.25),
          ),
        ),
        child: Row(
          children: [
            Icon(
              selected
                  ? Icons.radio_button_checked_rounded
                  : Icons.radio_button_off_rounded,
              color: selected
                  ? AppColors.errorRed
                  : AppColors.lightOrange.withValues(alpha: 0.5),
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                reason,
                style: TextStyle(
                  color: AppColors.lightOrange.withValues(alpha: 0.85),
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorBanner(String msg) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.errorRed.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.3)),
      ),
      child: Text(
        msg,
        style: const TextStyle(
          color: AppColors.errorRed,
          fontSize: 13,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildSuccessBanner(String msg) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF4CAF50).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFF4CAF50).withValues(alpha: 0.3),
        ),
      ),
      child: Text(
        msg,
        style: const TextStyle(
          color: Color(0xFF4CAF50),
          fontSize: 13,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(
        color: AppColors.lightOrange.withValues(alpha: 0.35),
        fontSize: 14,
      ),
      filled: true,
      fillColor: AppColors.darkBlue.withValues(alpha: 0.4),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: AppColors.lightBlue.withValues(alpha: 0.3),
        ),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: AppColors.lightBlue.withValues(alpha: 0.3),
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: AppColors.errorRed.withValues(alpha: 0.6),
        ),
      ),
    );
  }

  String _monthName(int m) {
    const months = [
      '',
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
    return months[m];
  }
}
