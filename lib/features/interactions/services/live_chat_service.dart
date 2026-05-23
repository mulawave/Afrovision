import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/config/app_config.dart';
import '../../../core/storage/auth_storage.dart';
import '../models/interaction_models.dart';

class LiveChatStatus {
  final bool connected;
  final String? error;

  const LiveChatStatus._({required this.connected, this.error});

  const LiveChatStatus.connected() : this._(connected: true);
  const LiveChatStatus.disconnected() : this._(connected: false);
  const LiveChatStatus.error(String message)
    : this._(connected: false, error: message);
}

class LiveChatSnapshot {
  final LiveChatMessageModel? message;
  final int viewerCount;
  final bool connected;
  final String? error;

  const LiveChatSnapshot({
    this.message,
    required this.viewerCount,
    required this.connected,
    this.error,
  });
}

class LiveChatService {
  final _messageController = StreamController<LiveChatMessageModel>.broadcast();
  final _viewerCountController = StreamController<int>.broadcast();
  final _statusController = StreamController<LiveChatStatus>.broadcast();
  final _snapshotController = StreamController<LiveChatSnapshot>.broadcast();

  io.Socket? _socket;
  String? _channelId;
  int _latestViewerCount = 0;
  LiveChatStatus _latestStatus = const LiveChatStatus.disconnected();

  Stream<LiveChatMessageModel> get messages => _messageController.stream;
  Stream<int> get viewerCounts => _viewerCountController.stream;
  Stream<LiveChatStatus> get statuses => _statusController.stream;
  Stream<LiveChatSnapshot> get snapshots => _snapshotController.stream;

  void _emitSnapshot({LiveChatMessageModel? message}) {
    _snapshotController.add(
      LiveChatSnapshot(
        message: message,
        viewerCount: _latestViewerCount,
        connected: _latestStatus.connected,
        error: _latestStatus.error,
      ),
    );
  }

  Future<void> connect(String channelId) async {
    final token = await AuthStorage.getToken();
    if (token == null || token.isEmpty) {
      throw Exception('Authentication required to join live chat');
    }

    disconnect();
    _channelId = channelId;

    final socket = io.io(
      AppConfig.baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .enableReconnection()
          .build(),
    );

    _socket = socket;

    socket.onConnect((_) {
      _latestStatus = const LiveChatStatus.connected();
      _statusController.add(_latestStatus);
      _emitSnapshot();
      socket.emitWithAck(
        'channel:join',
        {'channelId': channelId},
        ack: (response) {
          final payload = _toMap(response);
          if (payload['ok'] == true) {
            _latestViewerCount =
                (payload['viewer_count'] as num?)?.toInt() ?? 0;
            _viewerCountController.add(_latestViewerCount);
            _emitSnapshot();
            return;
          }
          _latestStatus = LiveChatStatus.error(
            payload['error'] as String? ?? 'Unable to join live chat',
          );
          _statusController.add(_latestStatus);
          _emitSnapshot();
        },
      );
    });

    socket.onDisconnect((_) {
      _latestStatus = const LiveChatStatus.disconnected();
      _statusController.add(_latestStatus);
      _emitSnapshot();
    });

    socket.onConnectError((error) {
      _latestStatus = LiveChatStatus.error(error.toString());
      _statusController.add(_latestStatus);
      _emitSnapshot();
    });

    socket.on('chat:message', (data) {
      final payload = _toMap(data);
      final message = LiveChatMessageModel.fromJson(payload);
      _messageController.add(message);
      _emitSnapshot(message: message);
    });

    socket.on('channel:viewer_count', (data) {
      final payload = _toMap(data);
      _latestViewerCount = (payload['viewer_count'] as num?)?.toInt() ?? 0;
      _viewerCountController.add(_latestViewerCount);
      _emitSnapshot();
    });

    socket.connect();
  }

  Future<String?> sendMessage(String text) async {
    final socket = _socket;
    final channelId = _channelId;
    if (socket == null || channelId == null) {
      return 'Live chat is not connected';
    }

    final completer = Completer<String?>();
    socket.emitWithAck(
      'chat:send',
      {'channelId': channelId, 'text': text},
      ack: (response) {
        final payload = _toMap(response);
        if (payload['ok'] == true) {
          completer.complete(null);
        } else {
          completer.complete(
            payload['error'] as String? ?? 'Unable to send your message',
          );
        }
      },
    );

    return completer.future;
  }

  void disconnect() {
    final socket = _socket;
    final channelId = _channelId;
    if (socket != null && channelId != null) {
      socket.emit('channel:leave', {'channelId': channelId});
      socket.disconnect();
      socket.dispose();
    }
    _socket = null;
    _channelId = null;
  }

  void dispose() {
    disconnect();
    _messageController.close();
    _viewerCountController.close();
    _statusController.close();
    _snapshotController.close();
  }

  Map<String, dynamic> _toMap(dynamic raw) {
    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) {
      return raw.map((key, value) => MapEntry(key.toString(), value));
    }
    return <String, dynamic>{};
  }
}
