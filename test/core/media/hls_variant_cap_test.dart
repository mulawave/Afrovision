import 'package:afrovision/core/media/hls_variant_cap.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final base = Uri.parse('https://cdn.example.com/live/ch1/master.m3u8?token=abc');

  const master = '''
#EXTM3U
#EXT-X-VERSION:4
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="en",URI="audio/en.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=350000,AVERAGE-BANDWIDTH=300000,RESOLUTION=426x240,AUDIO="aud"
240p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360,AUDIO="aud"
360p/index.m3u8?token=abc
#EXT-X-STREAM-INF:BANDWIDTH=3500000,RESOLUTION=1280x720,AUDIO="aud"
https://other.example.com/720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1920x1080,AUDIO="aud"
/abs/1080p.m3u8
''';

  test('drops variants above the cap and makes URIs absolute', () {
    final out = HlsVariantCap.capMasterPlaylist(master, base, 1500000)!;

    expect(out, contains('https://cdn.example.com/live/ch1/240p/index.m3u8'));
    expect(out, contains('https://cdn.example.com/live/ch1/360p/index.m3u8?token=abc'));
    expect(out, isNot(contains('720p')));
    expect(out, isNot(contains('1080p')));
    expect(out, contains('URI="https://cdn.example.com/live/ch1/audio/en.m3u8"'));
    expect('#EXT-X-STREAM-INF'.allMatches(out).length, 2);
  });

  test('keeps the lowest variant when every variant is above the cap', () {
    final out = HlsVariantCap.capMasterPlaylist(master, base, 100000)!;

    expect('#EXT-X-STREAM-INF'.allMatches(out).length, 1);
    expect(out, contains('240p/index.m3u8'));
  });

  test('returns null when nothing exceeds the cap', () {
    expect(HlsVariantCap.capMasterPlaylist(master, base, 10000000), isNull);
  });

  test('returns null for a media playlist', () {
    const media = '#EXTM3U\n#EXTINF:4.0,\nseg1.ts\n';
    expect(HlsVariantCap.capMasterPlaylist(media, base, 500000), isNull);
  });

  test('ignores AVERAGE-BANDWIDTH when reading BANDWIDTH', () {
    const playlist = '''
#EXTM3U
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=400000,BANDWIDTH=2000000
hi.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=200000,BANDWIDTH=600000
lo.m3u8
''';
    final out = HlsVariantCap.capMasterPlaylist(playlist, base, 1000000)!;
    expect(out, contains('lo.m3u8'));
    expect(out, isNot(contains('hi.m3u8')));
  });
}
