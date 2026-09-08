/// Shaped discovery item returned by /catchup/home and /catchup/detail.
class CatchUpItem {
  final String id;
  final String type; // 'movie' | 'series'
  final String title;
  final String overview;
  final String? posterUrl;
  final String? backdropUrl;
  final String? trailerUrl;
  final double rating;
  final String? releaseDate;
  final int? runtime; // minutes; episode runtime for series
  final String? certification; // e.g. PG-13, TV-MA
  final List<String> genres;
  final List<CatchUpCredit> cast;
  final List<CatchUpCredit> directors;
  final List<CatchUpCredit> producers;
  final List<CatchUpCredit> writers;
  final List<CatchUpItem> recommendations;

  const CatchUpItem({
    required this.id,
    required this.type,
    required this.title,
    this.overview = '',
    this.posterUrl,
    this.backdropUrl,
    this.trailerUrl,
    this.rating = 0,
    this.releaseDate,
    this.runtime,
    this.certification,
    this.genres = const [],
    this.cast = const [],
    this.directors = const [],
    this.producers = const [],
    this.writers = const [],
    this.recommendations = const [],
  });

  factory CatchUpItem.fromJson(Map<String, dynamic> json) {
    return CatchUpItem(
      id: (json['id'] ?? '').toString(),
      type: (json['type'] ?? 'movie').toString(),
      title: (json['title'] ?? 'Untitled').toString(),
      overview: (json['overview'] ?? '').toString(),
      posterUrl: json['posterUrl'] as String?,
      backdropUrl: json['backdropUrl'] as String?,
      trailerUrl: json['trailerUrl'] as String?,
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
      releaseDate: json['releaseDate'] as String?,
      runtime: json['runtime'] as int?,
      certification: json['certification'] as String?,
      genres: _stringList(json['genres']),
      cast: _creditList(json['cast']),
      directors: _creditList(json['directors']),
      producers: _creditList(json['producers']),
      writers: _creditList(json['writers']),
      recommendations: CatchUpHome._itemList(json['recommendations']),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'title': title,
        'overview': overview,
        'posterUrl': posterUrl,
        'backdropUrl': backdropUrl,
        'trailerUrl': trailerUrl,
        'rating': rating,
        'releaseDate': releaseDate,
        'runtime': runtime,
        'certification': certification,
        'genres': genres,
        'cast': cast.map((c) => c.toJson()).toList(),
        'directors': directors.map((c) => c.toJson()).toList(),
        'producers': producers.map((c) => c.toJson()).toList(),
        'writers': writers.map((c) => c.toJson()).toList(),
        'recommendations': recommendations.map((i) => i.toJson()).toList(),
      };
}

class CatchUpCredit {
  final String id;
  final String name;
  final String? role; // character for cast, job for directors
  final String? profileUrl;

  const CatchUpCredit({
    required this.id,
    required this.name,
    this.role,
    this.profileUrl,
  });

  factory CatchUpCredit.fromJson(Map<String, dynamic> json) {
    return CatchUpCredit(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? 'Unknown').toString(),
      role: json['character'] as String? ?? json['job'] as String?,
      profileUrl: json['profileUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'character': role,
        'profileUrl': profileUrl,
      };
}

class CatchUpPerson {
  final String id;
  final String name;
  final String? profileUrl;
  final List<String> knownFor;

  const CatchUpPerson({
    required this.id,
    required this.name,
    this.profileUrl,
    this.knownFor = const [],
  });

  factory CatchUpPerson.fromJson(Map<String, dynamic> json) {
    return CatchUpPerson(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? 'Unknown').toString(),
      profileUrl: json['profileUrl'] as String?,
      knownFor: (json['knownFor'] as List? ?? [])
          .whereType<String>()
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'profileUrl': profileUrl,
        'knownFor': knownFor,
      };
}

class CatchUpRail {
  final String title;
  final List<CatchUpItem> items;

  const CatchUpRail({
    required this.title,
    this.items = const [],
  });

  factory CatchUpRail.fromJson(Map<String, dynamic> json) {
    return CatchUpRail(
      title: (json['title'] ?? '').toString(),
      items: (json['items'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(CatchUpItem.fromJson)
          .toList(),
    );
  }
}

class CatchUpHome {
  final List<CatchUpItem> hero;
  final CatchUpItem? episodeSpotlight;
  final List<CatchUpPerson> trendingPeople;
  final List<CatchUpRail> rails;

  const CatchUpHome({
    this.hero = const [],
    this.episodeSpotlight,
    this.trendingPeople = const [],
    this.rails = const [],
  });

  factory CatchUpHome.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;
    List<CatchUpRail> rails = (data['rails'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(CatchUpRail.fromJson)
        .toList();

    // Backwards compatibility: if the server returns the old flat rails,
    // build a simple rails list from them.
    if (rails.isEmpty) {
      final legacyMap = {
        'Featured': data['featured'],
        'What to Watch': data['what_to_watch'],
        'Top Picks': data['top_picks'],
        'Current TV Shows': data['current_tv'],
        'Upcoming Movies': data['upcoming_movies'],
      };
      for (final entry in legacyMap.entries) {
        final items = _itemList(entry.value);
        if (items.isNotEmpty) rails.add(CatchUpRail(title: entry.key, items: items));
      }
    }

    return CatchUpHome(
      hero: _itemList(data['hero']),
      episodeSpotlight: data['episode_spotlight'] == null
          ? null
          : CatchUpItem.fromJson(
              data['episode_spotlight'] as Map<String, dynamic>),
      trendingPeople: (data['trending_people'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(CatchUpPerson.fromJson)
          .toList(),
      rails: rails,
    );
  }

  static List<CatchUpItem> _itemList(dynamic list) {
    return (list as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(CatchUpItem.fromJson)
        .toList();
  }
}

List<String> _stringList(dynamic list) {
  return (list as List? ?? []).whereType<String>().toList();
}

List<CatchUpCredit> _creditList(dynamic list) {
  return (list as List? ?? [])
      .whereType<Map<String, dynamic>>()
      .map(CatchUpCredit.fromJson)
      .toList();
}
