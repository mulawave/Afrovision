class ReputationModel {
  final String userId;
  final double totalReps;
  final int level;
  final double totalGiftingNgn;
  final double totalGiftingVpt;
  final bool communityPoolEligible;
  final int? leaderboardRank;
  final String? lastUpdated;

  const ReputationModel({
    required this.userId,
    required this.totalReps,
    required this.level,
    required this.totalGiftingNgn,
    required this.totalGiftingVpt,
    required this.communityPoolEligible,
    this.leaderboardRank,
    this.lastUpdated,
  });

  factory ReputationModel.fromJson(Map<String, dynamic> json) {
    return ReputationModel(
      userId: json['user_id'] as String? ?? '',
      totalReps: (json['total_reps'] as num?)?.toDouble() ?? 0.0,
      level: (json['level'] as num?)?.toInt() ?? 0,
      totalGiftingNgn: (json['total_gifting_ngn'] as num?)?.toDouble() ?? 0.0,
      totalGiftingVpt: (json['total_gifting_vpt'] as num?)?.toDouble() ?? 0.0,
      communityPoolEligible: json['community_pool_eligible'] as bool? ?? false,
      leaderboardRank: (json['leaderboard_rank'] as num?)?.toInt(),
      lastUpdated: json['last_updated'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'user_id': userId,
    'total_reps': totalReps,
    'level': level,
    'total_gifting_ngn': totalGiftingNgn,
    'total_gifting_vpt': totalGiftingVpt,
    'community_pool_eligible': communityPoolEligible,
    'leaderboard_rank': leaderboardRank,
    'last_updated': lastUpdated,
  };

  /// Human-readable level name.
  String get levelName {
    switch (level) {
      case 1:
        return 'Level 1';
      case 2:
        return 'Level 2';
      case 3:
        return 'Level 3';
      default:
        return 'None';
    }
  }

  /// Reps needed to reach the next level, or null if already at max.
  double? get nextLevelThreshold {
    switch (level) {
      case 0:
        return 5100;
      case 1:
        return 9000;
      case 2:
        return 30000;
      default:
        return null; // Level 3 = max
    }
  }

  /// Reps at the start of the current level band.
  double get _currentLevelStart {
    switch (level) {
      case 1:
        return 5100;
      case 2:
        return 9000;
      case 3:
        return 30000;
      default:
        return 0;
    }
  }

  /// Progress 0.0–1.0 within the current level band toward the next threshold.
  double get progressPercent {
    final next = nextLevelThreshold;
    if (next == null) return 1.0; // max level
    final start = _currentLevelStart;
    final span = next - start;
    if (span <= 0) return 1.0;
    return ((totalReps - start) / span).clamp(0.0, 1.0);
  }
}

class ReputationLeaderboardEntry {
  final int rank;
  final String userId;
  final String name;
  final double totalReps;
  final int level;

  const ReputationLeaderboardEntry({
    required this.rank,
    required this.userId,
    required this.name,
    required this.totalReps,
    required this.level,
  });

  factory ReputationLeaderboardEntry.fromJson(Map<String, dynamic> json) {
    return ReputationLeaderboardEntry(
      rank: (json['rank'] as num?)?.toInt() ?? 0,
      userId: json['user_id'] as String? ?? '',
      name: json['name'] as String? ?? 'Unknown',
      totalReps: (json['total_reps'] as num?)?.toDouble() ?? 0.0,
      level: (json['level'] as num?)?.toInt() ?? 0,
    );
  }
}
