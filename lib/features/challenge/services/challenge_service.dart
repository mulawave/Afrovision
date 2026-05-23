import '../../../core/api/api_service.dart';
import '../models/challenge_model.dart';

class ChallengeService {
  /// Fetch the currently active challenge.
  /// Returns null if no active challenge exists.
  static Future<ChallengeModel?> getActiveChallenge() async {
    final data = await ApiService.get('/challenge/active');
    // Backend returns the challenge fields directly (not nested)
    if (data['id'] == null) return null;
    return ChallengeModel.fromJson(data);
  }
}
