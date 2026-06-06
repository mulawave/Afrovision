import 'package:flutter/material.dart';
import '../../../core/api/api_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_pagination_controls.dart';

class Update {
  final String id;
  final String title;
  final String summary;
  final String? body;
  final String date;
  final String icon;
  final String tag;

  const Update({
    required this.id,
    required this.title,
    required this.summary,
    this.body,
    required this.date,
    required this.icon,
    required this.tag,
  });

  factory Update.fromJson(Map<String, dynamic> json) {
    return Update(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      body: json['body'] as String?,
      date: json['date'] as String? ?? '',
      icon: json['icon'] as String? ?? '✨',
      tag: json['tag'] as String? ?? '',
    );
  }

  String get displayContent => body ?? summary;
}

class UpdatesScreen extends StatefulWidget {
  const UpdatesScreen({super.key});

  @override
  State<UpdatesScreen> createState() => _UpdatesScreenState();
}

class _UpdatesScreenState extends State<UpdatesScreen> {
  List<Update> _allUpdates = [];
  bool _loading = true;
  final int _pageSize = 7;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _loadUpdates();
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _loadUpdates() async {
    try {
      final data = await ApiService.get('/home/content');
      final homepage = data['homepage'] as Map<String, dynamic>?;
      final sections = homepage?['sections'] as List?;
      final updatesSection = sections?.firstWhere(
        (section) => section['key'] == 'updates',
        orElse: () => null,
      ) as Map<String, dynamic>?;
      final items = updatesSection?['items'] as List?;
      
      if (items != null) {
        setState(() {
          _allUpdates = items.map((item) => Update.fromJson(item as Map<String, dynamic>)).toList();
          _loading = false;
        });
      } else {
        setState(() {
          _loading = false;
        });
      }
    } catch (e) {
      setState(() {
        _loading = false;
      });
    }
  }

  List<Update> _getCurrentPageUpdates() {
    final startIndex = _currentPage * _pageSize;
    final endIndex = startIndex + _pageSize;
    return _allUpdates.sublist(startIndex, endIndex > _allUpdates.length ? _allUpdates.length : endIndex);
  }

  int get _totalPages => (_allUpdates.length / _pageSize).ceil();

  Color _getColorForTag(String tag) {
    final tagMap = {
      'New Feature': AppColors.lightOrange,
      'Monetization': const Color(0xFF4CAF50),
      'Enhancement': AppColors.orange,
      'Economy': const Color(0xFFFFD700),
      'Platform': const Color(0xFF2196F3),
      'Performance': const Color(0xFF9C27B0),
    };
    return tagMap[tag] ?? AppColors.lightOrange;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBlue,
      appBar: AppBar(
        backgroundColor: AppColors.darkBlue,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: AppColors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Updates',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.orange),
            )
          : _allUpdates.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.campaign_rounded,
                        size: 64,
                        color: AppColors.hintText,
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'No updates yet',
                        style: TextStyle(
                          color: AppColors.hintText,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: ListView.builder(
                        padding: const EdgeInsets.all(20),
                        itemCount: _getCurrentPageUpdates().length,
                        itemBuilder: (context, index) {
                          final update = _getCurrentPageUpdates()[index];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 16),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.inputFill,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: AppColors.inputBorder),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: _getColorForTag(update.tag).withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    update.icon,
                                    style: TextStyle(fontSize: 24),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              update.title,
                                              style: const TextStyle(
                                                color: AppColors.white,
                                                fontSize: 16,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ),
                                          if (update.tag.isNotEmpty)
                                            Container(
                                              padding: const EdgeInsets.symmetric(
                                                horizontal: 8,
                                                vertical: 4,
                                              ),
                                              decoration: BoxDecoration(
                                                color: _getColorForTag(update.tag).withValues(alpha: 0.2),
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: Text(
                                                update.tag,
                                                style: TextStyle(
                                                  color: _getColorForTag(update.tag),
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      Text(
                                        update.displayContent,
                                        style: const TextStyle(
                                          color: AppColors.lightOrange,
                                          fontSize: 15,
                                          height: 1.6,
                                        ),
                                        textAlign: TextAlign.justify,
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        update.date,
                                        style: const TextStyle(
                                          color: AppColors.hintText,
                                          fontSize: 12,
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
                    if (_totalPages > 1)
                      Padding(
                        padding: const EdgeInsets.all(20),
                        child: AppPaginationControls(
                          currentPage: _currentPage,
                          totalPages: _totalPages,
                          onPrevious: _currentPage > 0
                              ? () {
                                  setState(() {
                                    _currentPage--;
                                  });
                                }
                              : null,
                          onNext: _currentPage < _totalPages - 1
                              ? () {
                                  setState(() {
                                    _currentPage++;
                                  });
                                }
                              : null,
                        ),
                      ),
                  ],
                ),
    );
  }
}
