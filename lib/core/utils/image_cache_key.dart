/// Returns a stable cache key for an image URL.
///
/// Firebase / GCS signed URLs may contain a `token` query parameter that
/// changes on every API call. Using the full URL as a cache key makes the
/// app download the same image repeatedly. This helper strips the query
/// string and keeps only the scheme, host, and path so that the same
/// underlying asset always maps to the same cache entry.
String? imageCacheKey(String? url) {
  if (url == null || url.isEmpty) return null;
  try {
    final uri = Uri.parse(url);
    return '${uri.scheme}://${uri.host}${uri.path}';
  } catch (_) {
    return url;
  }
}
