import '../../reputation/models/reputation_model.dart';
import '../../../core/api/api_service.dart';

class ReputationService {
  /// Fetch the authenticated user's full reputation record.
  static Future<ReputationModel> getMyReputation() async {
    final data = await ApiService.get('/reputation/me');
    return ReputationModel.fromJson(data['reputation'] as Map<String, dynamic>);
  }

  /// Fetch the global leaderboard, paginated.
  static Future<List<ReputationLeaderboardEntry>> getLeaderboard({
    int limit = 50,
    int offset = 0,
  }) async {
    final data = await ApiService.get(
      '/reputation/leaderboard?limit=$limit&offset=$offset',
    );
    final items = data['leaderboard'] as List<dynamic>? ?? [];
    return items
        .map(
          (e) => ReputationLeaderboardEntry.fromJson(e as Map<String, dynamic>),
        )
        .toList();
  }

  /// Fetch a public reputation summary for any user.
  static Future<ReputationModel> getUserReputation(String userId) async {
    final data = await ApiService.get('/reputation/user/$userId');
    return ReputationModel.fromJson(data['reputation'] as Map<String, dynamic>);
  }
}
