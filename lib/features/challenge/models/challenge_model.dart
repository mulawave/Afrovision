class ChallengePhaseWindow {
  final String? start;
  final String? end;

  const ChallengePhaseWindow({this.start, this.end});

  factory ChallengePhaseWindow.fromJson(Map<String, dynamic> json) {
    return ChallengePhaseWindow(
      start: json['start'] as String?,
      end: json['end'] as String?,
    );
  }
}

class ChallengeModel {
  final String id;
  final String title;
  final String subtitle;
  final int season;
  final String phase;
  final String description;
  final String prizePool;
  final int maxContestants;
  final int videoMinSeconds;
  final int videoMaxSeconds;
  final Map<String, ChallengePhaseWindow> phases;
  final List<String> prizes;
  final List<String> rules;
  final List<dynamic> judges;
  final List<dynamic> sponsors;
  final String? bannerUrl;
  final String? trailerUrl;
  final bool isActive;
  final String createdAt;

  const ChallengeModel({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.season,
    required this.phase,
    required this.description,
    required this.prizePool,
    required this.maxContestants,
    required this.videoMinSeconds,
    required this.videoMaxSeconds,
    required this.phases,
    required this.prizes,
    required this.rules,
    required this.judges,
    required this.sponsors,
    this.bannerUrl,
    this.trailerUrl,
    required this.isActive,
    required this.createdAt,
  });

  factory ChallengeModel.fromJson(Map<String, dynamic> json) {
    final rawPhases = json['phases'] as Map<String, dynamic>? ?? {};
    final parsedPhases = <String, ChallengePhaseWindow>{};
    for (final entry in rawPhases.entries) {
      parsedPhases[entry.key] = ChallengePhaseWindow.fromJson(
        entry.value as Map<String, dynamic>? ?? {},
      );
    }

    return ChallengeModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'AfroVision Challenge',
      subtitle: json['subtitle'] as String? ?? '',
      season: (json['season'] as num?)?.toInt() ?? 1,
      phase: json['phase'] as String? ?? 'registration-and-audition',
      description: json['description'] as String? ?? '',
      prizePool: json['prize_pool'] as String? ?? '',
      maxContestants: (json['max_contestants'] as num?)?.toInt() ?? 15,
      videoMinSeconds: (json['video_min_seconds'] as num?)?.toInt() ?? 30,
      videoMaxSeconds: (json['video_max_seconds'] as num?)?.toInt() ?? 60,
      phases: parsedPhases,
      prizes: List<String>.from(json['prizes'] as List? ?? []),
      rules: List<String>.from(json['rules'] as List? ?? []),
      judges: List<dynamic>.from(json['judges'] as List? ?? []),
      sponsors: List<dynamic>.from(json['sponsors'] as List? ?? []),
      bannerUrl: json['banner_url'] as String?,
      trailerUrl: json['trailer_url'] as String?,
      isActive: json['is_active'] as bool? ?? true,
      createdAt: json['created_at'] as String? ?? '',
    );
  }

  bool get isRegistrationOpen =>
      phase == 'registration-and-audition' || phase == 'registration';
  bool get isAuditionPhase =>
      phase == 'registration-and-audition' || phase == 'audition';
  bool get isRunning => phase == 'running';
  bool get isCompleted => phase == 'completed' || phase == 'incubation';

  String get phaseLabel {
    switch (phase) {
      case 'pre-register':
        return 'Pre-register';
      case 'registration-and-audition':
        return 'Registration & Audition';
      case 'registration':
        return 'Registration Open';
      case 'audition':
        return 'Audition Phase';
      case 'kickoff':
        return 'Kickoff';
      case 'running':
        return 'Live & Running';
      case 'incubation':
        return 'Incubation';
      case 'completed':
        return 'Completed';
      default:
        return phase;
    }
  }
}
