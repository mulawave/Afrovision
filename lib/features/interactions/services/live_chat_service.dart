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

class LiveChatService {
  final _messageController = StreamController<LiveChatMessageModel>.broadcast();
  final _viewerCountController = StreamController<int>.broadcast();
  final _statusController = StreamController<LiveChatStatus>.broadcast();

  io.Socket? _socket;
  String? _channelId;

  Stream<LiveChatMessageModel> get messages => _messageController.stream;
  Stream<int> get viewerCounts => _viewerCountController.stream;
  Stream<LiveChatStatus> get statuses => _statusController.stream;

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
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .enableReconnection()
          .build(),
    );

    _socket = socket;

    socket.onConnect((_) {
      _statusController.add(const LiveChatStatus.connected());
      socket.emitWithAck(
        'channel:join',
        {'channelId': channelId},
        ack: (response) {
          final payload = _toMap(response);
          if (payload['ok'] == true) {
            _viewerCountController.add(
              (payload['viewer_count'] as num?)?.toInt() ?? 0,
            );
            return;
          }
          _statusController.add(
            LiveChatStatus.error(
              payload['error'] as String? ?? 'Unable to join live chat',
            ),
          );
        },
      );
    });

    socket.onDisconnect((_) {
      _statusController.add(const LiveChatStatus.disconnected());
    });

    socket.onConnectError((error) {
      _statusController.add(LiveChatStatus.error(error.toString()));
    });

    socket.on('chat:message', (data) {
      final payload = _toMap(data);
      _messageController.add(LiveChatMessageModel.fromJson(payload));
    });

    socket.on('channel:viewer_count', (data) {
      final payload = _toMap(data);
      _viewerCountController.add(
        (payload['viewer_count'] as num?)?.toInt() ?? 0,
      );
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
  }

  Map<String, dynamic> _toMap(dynamic raw) {
    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) {
      return raw.map((key, value) => MapEntry(key.toString(), value));
    }
    return <String, dynamic>{};
  }
}
