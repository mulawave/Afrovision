import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';

/// Applies a bitrate ceiling to an HLS master playlist for ExoPlayer, which
/// has no API for capping its adaptive selection.
///
/// Downloads the master playlist, drops variants above [capBps] (always
/// keeping at least the lowest one), makes every URI absolute and writes the
/// result to a local `.m3u8`. ExoPlayer then adapts freely *within* the cap.
/// Returns null whenever the original URL should be used unchanged: not a
/// master playlist, nothing above the cap, or any failure.
class HlsVariantCap {
  static Future<String?> writeCapped(
    String url, {
    required int capBps,
    Map<String, String> headers = const {},
  }) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 6);
    try {
      final request = await client.getUrl(Uri.parse(url));
      headers.forEach(request.headers.set);
      final response = await request.close().timeout(const Duration(seconds: 8));
      if (response.statusCode != 200) return null;
      final body = await response
          .transform(utf8.decoder)
          .join()
          .timeout(const Duration(seconds: 8));

      var base = Uri.parse(url);
      for (final redirect in response.redirects) {
        base = base.resolveUri(redirect.location);
      }

      final capped = capMasterPlaylist(body, base, capBps);
      if (capped == null) return null;

      final file = File(
        '${Directory.systemTemp.path}/av_capped_${url.hashCode.toUnsigned(32)}_$capBps.m3u8',
      );
      await file.writeAsString(capped, flush: true);
      return file.path;
    } catch (e) {
      debugPrint('[HlsVariantCap] using original playlist: $e');
      return null;
    } finally {
      client.close(force: true);
    }
  }

  static final _bandwidth = RegExp(r'(?:^|[:,])BANDWIDTH=(\d+)');
  static final _uriAttr = RegExp(r'URI="([^"]*)"');

  @visibleForTesting
  static String? capMasterPlaylist(String body, Uri base, int capBps) {
    final lines = const LineSplitter().convert(body);
    if (!lines.any((l) => l.startsWith('#EXT-X-STREAM-INF:'))) return null;

    final variants = <({int index, int bandwidth})>[];
    for (var i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('#EXT-X-STREAM-INF:')) continue;
      final bw = int.tryParse(_bandwidth.firstMatch(lines[i])?.group(1) ?? '');
      variants.add((index: i, bandwidth: bw ?? 0));
    }

    var keep = variants.where((v) => v.bandwidth <= capBps).toList();
    if (keep.isEmpty) {
      final lowest = variants.reduce((a, b) => a.bandwidth <= b.bandwidth ? a : b);
      keep = [lowest];
    }
    if (keep.length == variants.length) return null;
    final keepIndexes = keep.map((v) => v.index).toSet();

    String absolute(String ref) => base.resolve(ref).toString();

    final out = <String>[];
    for (var i = 0; i < lines.length; i++) {
      final line = lines[i];
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        // The variant's URI is the next non-tag line.
        var j = i + 1;
        while (j < lines.length && lines[j].trim().isEmpty) {
          j++;
        }
        if (keepIndexes.contains(i) && j < lines.length) {
          out
            ..add(line)
            ..add(absolute(lines[j].trim()));
        }
        i = j;
        continue;
      }
      if (line.startsWith('#')) {
        out.add(line.replaceAllMapped(
          _uriAttr,
          (m) => 'URI="${absolute(m.group(1)!)}"',
        ));
        continue;
      }
      if (line.trim().isNotEmpty) out.add(absolute(line.trim()));
    }
    return '${out.join('\n')}\n';
  }
}
