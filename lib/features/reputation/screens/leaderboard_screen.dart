import '../../../core/ads/pangle_widgets.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/reputation_badge.dart';
import '../../../features/auth/services/auth_service.dart';
import '../models/reputation_model.dart';
import '../services/reputation_service.dart';

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  static const _pageSize = 50;

  List<ReputationLeaderboardEntry> _entries = [];
  String? _currentUserId;
  bool _loading = true;
  String? _error;
  int _offset = 0;
  bool _hasMore = true;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.15),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
    _load(reset: true);
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    try {
      if (reset) {
        setState(() {
          _loading = true;
          _error = null;
          _offset = 0;
        });
      }
      final results = await Future.wait([
        ReputationService.getLeaderboard(limit: _pageSize, offset: _offset),
        if (_currentUserId == null) AuthService.getCurrentUser(),
      ]);
      final entries = results[0] as List<ReputationLeaderboardEntry>;
      final user = results.length > 1 ? results[1] as dynamic : null;

      if (mounted) {
        setState(() {
          if (reset) {
            _entries = entries;
          } else {
            _entries = [..._entries, ...entries];
          }
          if (user != null) _currentUserId = (user as dynamic).id as String?;
          _hasMore = entries.length == _pageSize;
          _loading = false;
        });
        _animCtrl.forward(from: 0);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
        _animCtrl.forward(from: 0);
      }
    }
  }

  Future<void> _loadMore() async {
    if (!_hasMore || _loading) return;
    setState(() {
      _offset += _pageSize;
    });
    await _load();
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
              _buildAppBar(context),
              Expanded(
                child: _loading && _entries.isEmpty
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.orange,
                        ),
                      )
                    : _error != null && _entries.isEmpty
                    ? _buildError()
                    : FadeTransition(
                        opacity: _fadeIn,
                        child: SlideTransition(
                          position: _slideUp,
                          child: RefreshIndicator(
                            color: AppColors.orange,
                            backgroundColor: AppColors.cardBg,
                            onRefresh: () => _load(reset: true),
                            child: _buildList(),
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

  Widget _buildAppBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputBorder.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: AppColors.white,
                size: 18,
              ),
            ),
          ),
          const SizedBox(width: 16),
          const Expanded(
            child: Text(
              'Reputation Leaderboard',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 20,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const Icon(
            Icons.leaderboard_rounded,
            color: AppColors.orange,
            size: 24,
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: AppColors.errorRed,
              size: 48,
            ),
            const SizedBox(height: 16),
            const Text(
              'Could not load leaderboard',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: () => _load(reset: true),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  gradient: AppColors.buttonGradient,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Text(
                  'Retry',
                  style: TextStyle(
                    color: AppColors.darkBlue,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      itemCount: _entries.length + 2, // +1 load-more / end sentinel, +1 ad
      itemBuilder: (context, index) {
        if (index == _entries.length + 1) return const PangleBigBanner();
        if (index == _entries.length) {
          if (_hasMore) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: GestureDetector(
                onTap: _loadMore,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.cardBg,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: AppColors.inputBorder.withValues(alpha: 0.4),
                    ),
                  ),
                  child: _loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.orange,
                          ),
                        )
                      : const Text(
                          'Load More',
                          style: TextStyle(
                            color: AppColors.orange,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
            );
          }
          return const SizedBox(height: 32);
        }
        return _buildRow(_entries[index]);
      },
    );
  }

  Widget _buildRow(ReputationLeaderboardEntry entry) {
    final isMe = entry.userId == _currentUserId;
    final borderColor = isMe
        ? AppColors.orange.withValues(alpha: 0.5)
        : AppColors.inputBorder.withValues(alpha: 0.3);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: isMe
            ? AppColors.orange.withValues(alpha: 0.08)
            : AppColors.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
          if (isMe)
            BoxShadow(
              color: AppColors.orange.withValues(alpha: 0.12),
              blurRadius: 16,
              spreadRadius: 0,
            ),
        ],
      ),
      child: Row(
        children: [
          // Rank
          SizedBox(
            width: 36,
            child: Text(
              '#${entry.rank}',
              style: TextStyle(
                color: entry.rank <= 3
                    ? AppColors.lightOrange
                    : AppColors.hintText,
                fontSize: entry.rank <= 3 ? 15 : 13,
                fontWeight: entry.rank <= 3 ? FontWeight.w800 : FontWeight.w600,
                letterSpacing: 0.3,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: 12),
          // Avatar
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AppColors.inputBorder,
              shape: BoxShape.circle,
              border: Border.all(
                color: _levelColor(entry.level).withValues(alpha: 0.5),
                width: 1.5,
              ),
            ),
            child: Center(
              child: Text(
                entry.name.isNotEmpty ? entry.name[0].toUpperCase() : '?',
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Name + badge
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        isMe ? '${entry.name} (You)' : entry.name,
                        style: TextStyle(
                          color: isMe ? AppColors.lightOrange : AppColors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (entry.level > 0) ...[
                      const SizedBox(width: 6),
                      ReputationBadgeWidget(level: entry.level, size: 14),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  entry.level > 0 ? 'Level ${entry.level}' : 'No Level',
                  style: TextStyle(
                    color: _levelColor(entry.level),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          // Total reps
          Text(
            _formatReps(entry.totalReps),
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Color _levelColor(int level) {
    switch (level) {
      case 1:
        return AppColors.reputationBlue;
      case 2:
        return AppColors.reputationPurple;
      case 3:
        return AppColors.orange;
      default:
        return AppColors.hintText;
    }
  }

  String _formatReps(double v) {
    if (v >= 1000) {
      return '${(v / 1000).toStringAsFixed(v % 1000 == 0 ? 0 : 1)}K';
    }
    return v.toStringAsFixed(0);
  }
}
