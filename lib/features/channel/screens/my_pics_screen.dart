import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_colors.dart';
import '../services/pic_storage_service.dart';
import '../services/channel_service.dart';

class MyPicsScreen extends StatefulWidget {
  const MyPicsScreen({super.key});

  @override
  State<MyPicsScreen> createState() => _MyPicsScreenState();
}

class _MyPicsScreenState extends State<MyPicsScreen> {
  bool _loading = true;
  String? _error;
  Map<String, String> _pics = {};
  Map<String, dynamic> _channelDetails = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final pics = await PicStorageService.getPics();
      final accesses = await ChannelService.getMyExclusiveAccesses();
      
      if (!mounted) return;
      
      // Create a map of channel_id to channel details
      final channelMap = <String, dynamic>{};
      for (final access in (accesses['accesses'] as List<dynamic>? ?? [])) {
        channelMap[access['channel_id']] = access;
      }

      setState(() {
        _pics = pics;
        _channelDetails = channelMap;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  String _formatDate(int timestamp) {
    final date = DateTime.fromMillisecondsSinceEpoch(timestamp);
    return '${date.day}/${date.month}/${date.year}';
  }

  void _copyPic(String pic) {
    Clipboard.setData(ClipboardData(text: pic));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('PIC copied to clipboard'),
        backgroundColor: Color(0xFF4CAF50),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Column(
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.arrow_back, color: AppColors.white),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'My Personal Identifier Codes',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),

              // Content
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(color: AppColors.orange),
                      )
                    : _error != null
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(20),
                              child: Text(
                                _error!,
                                style: const TextStyle(color: AppColors.white),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          )
                        : _pics.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.pin_rounded,
                                      size: 64,
                                      color: AppColors.white.withValues(alpha: 0.3),
                                    ),
                                    const SizedBox(height: 16),
                                    Text(
                                      'No PICs yet',
                                      style: TextStyle(
                                        color: AppColors.white.withValues(alpha: 0.6),
                                        fontSize: 16,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      'Purchase exclusive channel access to get your PICs',
                                      style: TextStyle(
                                        color: AppColors.white.withValues(alpha: 0.4),
                                        fontSize: 14,
                                      ),
                                      textAlign: TextAlign.center,
                                    ),
                                  ],
                                ),
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.all(20),
                                itemCount: _pics.length,
                                itemBuilder: (context, index) {
                                  final channelId = _pics.keys.elementAt(index);
                                  final pic = _pics[channelId]!;
                                  final channel = _channelDetails[channelId];
                                  final channelName = channel?['channel_name'] ?? 'Unknown Channel';
                                  final expiresAt = channel?['expires_at'];
                                  final logo = channel?['channel_logo'];

                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 16),
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      color: AppColors.cardBg,
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(color: AppColors.inputBorder),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            if (logo != null)
                                              ClipRRect(
                                                borderRadius: BorderRadius.circular(8),
                                                child: Image.network(
                                                  logo,
                                                  width: 48,
                                                  height: 48,
                                                  fit: BoxFit.cover,
                                                  errorBuilder: (context, error, stackTrace) {
                                                    return Container(
                                                      width: 48,
                                                      height: 48,
                                                      decoration: BoxDecoration(
                                                        color: AppColors.inputFill,
                                                        borderRadius: BorderRadius.circular(8),
                                                      ),
                                                      child: Icon(
                                                        Icons.tv,
                                                        color: AppColors.white.withValues(alpha: 0.3),
                                                      ),
                                                    );
                                                  },
                                                ),
                                              )
                                            else
                                              Container(
                                                width: 48,
                                                height: 48,
                                                decoration: BoxDecoration(
                                                  color: AppColors.inputFill,
                                                  borderRadius: BorderRadius.circular(8),
                                                ),
                                                child: Icon(
                                                  Icons.tv,
                                                  color: AppColors.white.withValues(alpha: 0.3),
                                                ),
                                              ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    channelName,
                                                    style: const TextStyle(
                                                      color: AppColors.white,
                                                      fontSize: 16,
                                                      fontWeight: FontWeight.w600,
                                                    ),
                                                  ),
                                                  if (expiresAt != null)
                                                    Text(
                                                      'Expires: ${_formatDate(expiresAt)}',
                                                      style: TextStyle(
                                                        color: AppColors.white.withValues(alpha: 0.6),
                                                        fontSize: 12,
                                                      ),
                                                    ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 16),
                                        Container(
                                          padding: const EdgeInsets.all(12),
                                          decoration: BoxDecoration(
                                            color: AppColors.inputFill,
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(color: AppColors.inputBorder),
                                          ),
                                          child: Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  pic,
                                                  style: const TextStyle(
                                                    color: AppColors.orange,
                                                    fontSize: 18,
                                                    fontWeight: FontWeight.w700,
                                                    letterSpacing: 2,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 12),
                                              IconButton(
                                                onPressed: () => _copyPic(pic),
                                                icon: const Icon(
                                                  Icons.copy_rounded,
                                                  color: AppColors.lightOrange,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
