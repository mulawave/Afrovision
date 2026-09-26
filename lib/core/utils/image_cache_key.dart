// Query parameters that only carry access/signing data. They change between
// API calls for the same file, so they're dropped from the cache key.
const _volatileParams = {'token', 'expires', 'signature', 'googleaccessid'};

/// Returns a stable cache key for an image URL.
///
/// Firebase / GCS signed URLs carry access parameters (`token`, `X-Goog-*`,
/// `Expires`, `Signature`, `GoogleAccessId`) that change on every API call
/// for the same file, so those are removed to avoid re-downloading. Every
/// other query parameter is kept: for some hosts the query IS the image
/// identity (e.g. Google image thumbnails, `images?q=tbn:...`). Stripping the
/// whole query made all such images share one cache entry, so one title
/// could show another title's cached cover.
String? imageCacheKey(String? url) {
  if (url == null || url.isEmpty) return null;
  try {
    final uri = Uri.parse(url);
    final kept = uri.queryParametersAll.entries
        .where((e) {
          final lower = e.key.toLowerCase();
          return !_volatileParams.contains(lower) && !lower.startsWith('x-goog-');
        })
        .toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    final parts = [for (final e in kept) for (final v in e.value) '${e.key}=$v'];
    final base = '${uri.scheme}://${uri.host}${uri.path}';
    return parts.isEmpty ? base : '$base?${parts.join('&')}';
  } catch (_) {
    return url;
  }
}
