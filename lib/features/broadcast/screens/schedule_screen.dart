import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../models/video_model.dart';
import '../models/program_model.dart';
import '../services/broadcast_service.dart';

class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key});

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeIn;
  late Animation<Offset> _slideUp;

  String? _channelId;
  bool _canManage = false;
  List<ProgramModel> _schedule = [];
  List<VideoModel> _videos = [];
  Map<String, dynamic>? _nowPlaying;
  Map<String, dynamic>? _schedulerState;
  bool _loading = true;
  String? _error;
  String? _deletingId;
  bool _selectionMode = false;
  final Set<String> _selectedProgramIds = {};

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.15),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_channelId == null) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is Map<String, dynamic>) {
        _channelId = args['channelId'] as String?;
        _canManage = args['canManage'] as bool? ?? false;
      } else if (args is String) {
        _channelId = args;
        _canManage = false;
      }
      if (_channelId != null) _loadData();
    }
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        BroadcastService.getChannelSchedule(_channelId!),
        BroadcastService.getChannelVideos(_channelId!),
        BroadcastService.getNowPlaying(_channelId!, preferCache: false),
      ]);
      if (!mounted) return;
      setState(() {
        _schedule = results[0] as List<ProgramModel>;
        _videos = (results[1] as ({List<VideoModel> videos, int? totalPages, int? page, int? total})).videos;
        final npData = results[2] as Map<String, dynamic>;
        _nowPlaying = npData['now_playing'] as Map<String, dynamic>?;
        _schedulerState = npData['scheduler_state'] as Map<String, dynamic>?;
        _selectedProgramIds.removeWhere(
          (id) => !_schedule.any((p) => p.id == id),
        );
        if (_selectedProgramIds.isEmpty) {
          _selectionMode = false;
        }
        _loading = false;
      });
      _animCtrl.forward();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
      _animCtrl.forward();
    }
  }

  void _showAddProgramSheet() {
    if (_videos.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Upload videos first before scheduling',
            style: TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
      return;
    }
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _ScheduleBottomSheet(
        videos: _videos,
        channelId: _channelId!,
        onScheduled: () {
          Navigator.pop(context);
          _loadData();
        },
      ),
    );
  }

  void _showSequentialSheet() {
    if (_videos.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Upload videos first before scheduling',
            style: TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
      return;
    }
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _SequentialBottomSheet(
        videos: _videos,
        channelId: _channelId!,
        onScheduled: () {
          Navigator.pop(context);
          _loadData();
        },
      ),
    );
  }

  Future<void> _deleteProgram(ProgramModel program) async {
    // Program locking: don't allow deletion of the live program or any
    // program that has already started.
    final now = DateTime.now().millisecondsSinceEpoch;
    final status = _statusLabel(program);
    if (status == 'LIVE' || program.startTime <= now) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Cannot delete a program that is currently live or has already started',
            style: TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
      return;
    }
    if (_deletingId != null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Remove Program',
          style: TextStyle(color: AppColors.white),
        ),
        content: Text(
          'Remove "${program.videoTitle ?? 'this program'}" from schedule?',
          style: const TextStyle(color: AppColors.hintText),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.hintText),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Remove',
              style: TextStyle(color: AppColors.errorRed),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _deletingId = program.id);
    try {
      await BroadcastService.deleteProgram(program.id);
      _loadData();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString(),
            style: const TextStyle(color: AppColors.white),
          ),
          backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _deletingId = null);
    }
  }

  void _toggleSelectionMode() {
    setState(() {
      _selectionMode = !_selectionMode;
      if (!_selectionMode) {
        _selectedProgramIds.clear();
      }
    });
  }

  void _toggleProgramSelection(ProgramModel program) {
    final status = _statusLabel(program);
    if (status == 'LIVE') return;

    setState(() {
      if (_selectedProgramIds.contains(program.id)) {
        _selectedProgramIds.remove(program.id);
      } else {
        _selectedProgramIds.add(program.id);
      }
      if (_selectedProgramIds.isEmpty) {
        _selectionMode = false;
      }
    });
  }

  void _selectAllUpcoming() {
    final now = DateTime.now().millisecondsSinceEpoch;
    final upcomingIds = _schedule
        .where((p) => p.startTime > now)
        .map((p) => p.id)
        .toSet();
    setState(() {
      _selectionMode = true;
      _selectedProgramIds
        ..clear()
        ..addAll(upcomingIds);
    });
  }

  Future<void> _bulkDeleteSelected() async {
    if (_selectedProgramIds.isEmpty) return;

    final count = _selectedProgramIds.length;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Delete Selected Programs',
          style: TextStyle(color: AppColors.white),
        ),
        content: Text(
          'Delete $count selected scheduled program${count == 1 ? '' : 's'}?',
          style: const TextStyle(color: AppColors.hintText),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.hintText),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Delete',
              style: TextStyle(color: AppColors.errorRed),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    final toDelete = List<String>.from(_selectedProgramIds);
    for (final id in toDelete) {
      try {
        await BroadcastService.deleteProgram(id);
      } catch (_) {
        // Continue deleting remaining selected entries.
      }
    }

    if (!mounted) return;
    setState(() {
      _selectedProgramIds.clear();
      _selectionMode = false;
    });
    await _loadData();
  }

  String _formatTime(int epochMs) {
    final dt = DateTime.fromMillisecondsSinceEpoch(epochMs);
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    final month = dt.month.toString().padLeft(2, '0');
    final day = dt.day.toString().padLeft(2, '0');
    return '$month/$day $h:$m';
  }

  String _statusLabel(ProgramModel p) {
    final now = DateTime.now().millisecondsSinceEpoch;
    final resolvedProgramId = _nowPlaying?['program_id'] as String? ??
        _schedulerState?['program_id'] as String?;
    // The backend resolver is the authoritative source for "what is live now".
    if (resolvedProgramId == p.id) return 'LIVE';
    // Fallback to wall-clock classification when resolver data isn't available.
    if (p.startTime <= now && p.endTime > now) return 'LIVE';
    if (p.endTime <= now) return 'ENDED';
    return 'SCHEDULED';
  }

  Color _statusColor(String label) {
    switch (label) {
      case 'LIVE':
        return AppColors.orange;
      case 'ENDED':
        return AppColors.hintText;
      default:
        return AppColors.lightOrange;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeIn,
            child: SlideTransition(
              position: _slideUp,
              child: Column(
                children: [
                  // ── Header ──
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 28,
                      vertical: 20,
                    ),
                    child: Row(
                      children: [
                        GestureDetector(
                          onTap: () => Navigator.pop(context),
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.cardBg,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: AppColors.inputBorder.withValues(
                                  alpha: 0.3,
                                ),
                              ),
                            ),
                            child: const Icon(
                              Icons.arrow_back_ios_new,
                              color: AppColors.white,
                              size: 18,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        const Expanded(
                          child: Text(
                            'SCHEDULE',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 2,
                            ),
                          ),
                        ),
                        if (_canManage) ...[
                          GestureDetector(
                            onTap: _showSequentialSheet,
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: AppColors.cardBg,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: AppColors.lightOrange.withValues(
                                    alpha: 0.4,
                                  ),
                                ),
                              ),
                              child: const Icon(
                                Icons.queue,
                                color: AppColors.lightOrange,
                                size: 20,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          GestureDetector(
                            onTap: _schedule.isEmpty
                                ? null
                                : _toggleSelectionMode,
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 160),
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: _selectionMode
                                    ? AppColors.orange.withValues(alpha: 0.2)
                                    : AppColors.cardBg,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: _selectionMode
                                      ? AppColors.orange.withValues(alpha: 0.5)
                                      : AppColors.inputBorder.withValues(
                                          alpha: 0.35,
                                        ),
                                ),
                              ),
                              child: Icon(
                                _selectionMode
                                    ? Icons.checklist_rtl_rounded
                                    : Icons.select_all_rounded,
                                color: _selectionMode
                                    ? AppColors.orange
                                    : AppColors.goldText,
                                size: 20,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          GestureDetector(
                            onTap: _showAddProgramSheet,
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                gradient: AppColors.buttonGradient,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(
                                Icons.add,
                                color: AppColors.white,
                                size: 20,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  // ── Content ──
                  Expanded(
                    child: _loading
                        ? const Center(
                            child: CircularProgressIndicator(
                              color: AppColors.orange,
                            ),
                          )
                        : _error != null
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(28),
                              child: Text(
                                _error!,
                                style: const TextStyle(
                                  color: AppColors.errorRed,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          )
                        : _schedule.isEmpty
                        ? _buildEmptyState()
                        : RefreshIndicator(
                            color: AppColors.orange,
                            onRefresh: _loadData,
                            child: ListView(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 28,
                              ),
                              children: _buildEpgSections(),
                            ),
                          ),
                  ),
                  if (_selectionMode && _canManage) _buildBulkActionBar(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _buildEpgSections() {
    final now = DateTime.now().millisecondsSinceEpoch;
    final live = <ProgramModel>[];
    final upcoming = <ProgramModel>[];
    final ended = <ProgramModel>[];

    for (final p in _schedule) {
      final status = _statusLabel(p);
      if (status == 'LIVE') {
        live.add(p);
      } else if (p.startTime > now) {
        upcoming.add(p);
      } else {
        ended.add(p);
      }
    }

    final widgets = <Widget>[];

    // NOW PLAYING section
    if (live.isNotEmpty) {
      widgets.add(_buildSectionHeader('NOW PLAYING', AppColors.orange));
      for (final p in live) {
        widgets.add(_buildProgramCard(p));
      }
    }

    // UP NEXT section
    if (upcoming.isNotEmpty) {
      widgets.add(_buildSectionHeader('UP NEXT', AppColors.lightOrange));
      for (final p in upcoming) {
        widgets.add(_buildProgramCard(p));
      }
    }

    // ENDED section (collapsed/dimmed)
    if (ended.isNotEmpty) {
      widgets.add(_buildSectionHeader('ENDED', AppColors.hintText));
      for (final p in ended) {
        widgets.add(Opacity(opacity: 0.5, child: _buildProgramCard(p)));
      }
    }

    return widgets;
  }

  Widget _buildSectionHeader(String title, Color color) {
    return Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 12),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 20,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            title,
            style: TextStyle(
              color: color,
              fontSize: 13,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.calendar_today_outlined,
            color: AppColors.goldText,
            size: 56,
          ),
          const SizedBox(height: 16),
          const Text(
            'No programs scheduled',
            style: TextStyle(
              color: AppColors.hintText,
              fontSize: 16,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          if (_canManage)
            Text(
              'Tap + to schedule a broadcast',
              style: TextStyle(color: AppColors.goldText, fontSize: 13),
            ),
        ],
      ),
    );
  }

  Widget _buildProgramCard(ProgramModel program) {
    final status = _statusLabel(program);
    final selectable = status != 'LIVE';
    final selected = _selectedProgramIds.contains(program.id);

    return GestureDetector(
      onTap: _selectionMode && selectable
          ? () => _toggleProgramSelection(program)
          : null,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: status == 'LIVE'
                ? AppColors.orange.withValues(alpha: 0.4)
                : AppColors.inputBorder.withValues(alpha: 0.3),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
            if (status == 'LIVE')
              BoxShadow(
                color: AppColors.orange.withValues(alpha: 0.08),
                blurRadius: 20,
              ),
          ],
        ),
        child: Row(
          children: [
            // Thumbnail placeholder
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.inputBorder.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.play_circle_outline,
                color: AppColors.hintText,
                size: 28,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    program.videoTitle ?? 'Unknown',
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${_formatTime(program.startTime)} → ${_formatTime(program.endTime)}',
                    style: const TextStyle(
                      color: AppColors.hintText,
                      fontSize: 12,
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: _statusColor(status).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      status,
                      style: TextStyle(
                        color: _statusColor(status),
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_canManage && _selectionMode && selectable)
              Padding(
                padding: const EdgeInsets.all(8),
                child: Icon(
                  selected
                      ? Icons.check_circle_rounded
                      : Icons.radio_button_unchecked_rounded,
                  color: selected ? AppColors.orange : AppColors.hintText,
                  size: 20,
                ),
              )
            else if (_canManage && status != 'LIVE')
              status == 'ENDED'
                  ? Padding(
                      padding: const EdgeInsets.all(8),
                      child: Icon(
                        Icons.lock_outline,
                        color: AppColors.goldText,
                        size: 18,
                      ),
                    )
                  : _deletingId == program.id
                  ? Padding(
                      padding: const EdgeInsets.all(8),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.goldText,
                          ),
                        ),
                      ),
                    )
                  : GestureDetector(
                      onTap: () => _deleteProgram(program),
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Icon(
                          Icons.delete_outline,
                          color: AppColors.goldText,
                          size: 20,
                        ),
                      ),
                    ),
          ],
        ),
      ),
    );
  }

  Widget _buildBulkActionBar() {
    final count = _selectedProgramIds.length;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        border: Border(
          top: BorderSide(color: AppColors.inputBorder.withValues(alpha: 0.35)),
        ),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: _selectAllUpcoming,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Text(
                'Select All Upcoming',
                style: TextStyle(
                  color: AppColors.goldText,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: AppButton(
              label: count == 0
                  ? 'Delete Selected'
                  : 'Delete Selected ($count)',
              onPressed: count == 0 ? null : _bulkDeleteSelected,
              enabled: count > 0,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Bottom sheet for scheduling a new program ───

class _ScheduleBottomSheet extends StatefulWidget {
  final List<VideoModel> videos;
  final String channelId;
  final VoidCallback onScheduled;

  const _ScheduleBottomSheet({
    required this.videos,
    required this.channelId,
    required this.onScheduled,
  });

  @override
  State<_ScheduleBottomSheet> createState() => _ScheduleBottomSheetState();
}

class _ScheduleBottomSheetState extends State<_ScheduleBottomSheet> {
  VideoModel? _selectedVideo;
  DateTime? _startDateTime;
  bool _scheduling = false;
  String? _error;

  Future<void> _pickDateTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(minutes: 5)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (ctx, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(
            primary: AppColors.orange,
            surface: AppColors.cardBg,
          ),
        ),
        child: child!,
      ),
    );
    if (date == null || !mounted) return;

    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
      builder: (ctx, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(
            primary: AppColors.orange,
            surface: AppColors.cardBg,
          ),
        ),
        child: child!,
      ),
    );
    if (time == null || !mounted) return;

    setState(() {
      _startDateTime = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      );
      _error = null;
    });
  }

  Future<void> _schedule() async {
    if (_selectedVideo == null) {
      setState(() => _error = 'Select a video');
      return;
    }
    if (_startDateTime == null) {
      setState(() => _error = 'Pick a start time');
      return;
    }
    setState(() {
      _scheduling = true;
      _error = null;
    });
    try {
      await BroadcastService.scheduleProgram(
        channelId: widget.channelId,
        videoId: _selectedVideo!.id,
        startTime: _startDateTime!.millisecondsSinceEpoch,
      );
      widget.onScheduled();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _scheduling = false;
      });
    }
  }

  String _formatDuration(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m}m ${s}s';
  }

  @override
  Widget build(BuildContext context) {
    final endTime = (_selectedVideo != null && _startDateTime != null)
        ? _startDateTime!.add(Duration(seconds: _selectedVideo!.duration))
        : null;

    return Container(
      padding: EdgeInsets.only(
        left: 28,
        right: 28,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 28,
      ),
      decoration: const BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.goldText,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'SCHEDULE PROGRAM',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 18,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 24),

          // Video selector
          const Text(
            'Video',
            style: TextStyle(
              color: AppColors.lightOrange,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: AppColors.inputFill,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<VideoModel>(
                isExpanded: true,
                value: _selectedVideo,
                hint: const Text(
                  'Select video',
                  style: TextStyle(color: AppColors.hintText, fontSize: 14),
                ),
                dropdownColor: AppColors.cardBg,
                style: const TextStyle(color: AppColors.white, fontSize: 14),
                items: widget.videos
                    .map(
                      (v) => DropdownMenuItem(
                        value: v,
                        child: Text(
                          '${v.title} (${_formatDuration(v.duration)})',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setState(() {
                  _selectedVideo = v;
                  _error = null;
                }),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Date/time picker
          const Text(
            'Start Time',
            style: TextStyle(
              color: AppColors.lightOrange,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: _pickDateTime,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _startDateTime != null
                          ? '${_startDateTime!.month}/${_startDateTime!.day}/${_startDateTime!.year}  ${_startDateTime!.hour.toString().padLeft(2, '0')}:${_startDateTime!.minute.toString().padLeft(2, '0')}'
                          : 'Tap to pick date & time',
                      style: TextStyle(
                        color: _startDateTime != null
                            ? AppColors.white
                            : AppColors.hintText,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.calendar_month,
                    color: AppColors.orange,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),

          // End time preview
          if (endTime != null) ...[
            const SizedBox(height: 12),
            Text(
              'Ends: ${endTime.month}/${endTime.day} ${endTime.hour.toString().padLeft(2, '0')}:${endTime.minute.toString().padLeft(2, '0')}',
              style: TextStyle(color: AppColors.goldText, fontSize: 13),
            ),
          ],

          // Error
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(
              _error!,
              style: const TextStyle(color: AppColors.errorRed, fontSize: 13),
            ),
          ],

          const SizedBox(height: 24),
          AppButton(
            label: _scheduling ? 'Scheduling...' : 'Schedule',
            onPressed: _scheduling ? null : _schedule,
            loading: _scheduling,
          ),
        ],
      ),
    );
  }
}

// ─── Bottom sheet for sequential (queue) scheduling ───

class _SequentialBottomSheet extends StatefulWidget {
  final List<VideoModel> videos;
  final String channelId;
  final VoidCallback onScheduled;

  const _SequentialBottomSheet({
    required this.videos,
    required this.channelId,
    required this.onScheduled,
  });

  @override
  State<_SequentialBottomSheet> createState() => _SequentialBottomSheetState();
}

class _SequentialBottomSheetState extends State<_SequentialBottomSheet> {
  final List<VideoModel> _selectedVideos = [];
  DateTime? _startDateTime;
  bool _scheduling = false;
  String? _error;

  void _toggleVideo(VideoModel video) {
    setState(() {
      if (_selectedVideos.contains(video)) {
        _selectedVideos.remove(video);
      } else {
        _selectedVideos.add(video);
      }
      _error = null;
    });
  }

  Future<void> _pickDateTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(minutes: 5)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (ctx, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(
            primary: AppColors.orange,
            surface: AppColors.cardBg,
          ),
        ),
        child: child!,
      ),
    );
    if (date == null || !mounted) return;

    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
      builder: (ctx, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(
            primary: AppColors.orange,
            surface: AppColors.cardBg,
          ),
        ),
        child: child!,
      ),
    );
    if (time == null || !mounted) return;

    setState(() {
      _startDateTime = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      );
      _error = null;
    });
  }

  Future<void> _schedule() async {
    if (_selectedVideos.isEmpty) {
      setState(() => _error = 'Select at least one video');
      return;
    }
    if (_startDateTime == null) {
      setState(() => _error = 'Pick a start time');
      return;
    }
    setState(() {
      _scheduling = true;
      _error = null;
    });
    try {
      await BroadcastService.scheduleSequential(
        channelId: widget.channelId,
        videoIds: _selectedVideos.map((v) => v.id).toList(),
        startTime: _startDateTime!.millisecondsSinceEpoch,
      );
      widget.onScheduled();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _scheduling = false;
      });
    }
  }

  String _formatDuration(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m}m ${s}s';
  }

  @override
  Widget build(BuildContext context) {
    // Compute chain preview
    int totalDuration = 0;
    for (final v in _selectedVideos) {
      totalDuration += v.duration;
    }
    final endTime = (_startDateTime != null && _selectedVideos.isNotEmpty)
        ? _startDateTime!.add(Duration(seconds: totalDuration))
        : null;

    return Container(
      padding: EdgeInsets.only(
        left: 28,
        right: 28,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 28,
      ),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.8,
      ),
      decoration: const BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.goldText,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'SCHEDULE QUEUE',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 18,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Select videos in playback order. They will be chained back-to-back.',
            style: TextStyle(color: AppColors.goldText, fontSize: 13),
          ),
          const SizedBox(height: 20),

          // Video multi-select list
          const Text(
            'Videos (tap to select)',
            style: TextStyle(
              color: AppColors.lightOrange,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: widget.videos.length,
              itemBuilder: (_, i) {
                final video = widget.videos[i];
                final idx = _selectedVideos.indexOf(video);
                final selected = idx >= 0;
                return GestureDetector(
                  onTap: () => _toggleVideo(video),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: selected
                          ? AppColors.orange.withValues(alpha: 0.1)
                          : AppColors.inputFill,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: selected
                            ? AppColors.orange.withValues(alpha: 0.5)
                            : AppColors.inputBorder,
                      ),
                    ),
                    child: Row(
                      children: [
                        if (selected)
                          Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              color: AppColors.orange,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Center(
                              child: Text(
                                '${idx + 1}',
                                style: const TextStyle(
                                  color: AppColors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          )
                        else
                          Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              border: Border.all(color: AppColors.goldText),
                              borderRadius: BorderRadius.circular(6),
                            ),
                          ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            video.title,
                            style: TextStyle(
                              color: selected
                                  ? AppColors.white
                                  : AppColors.hintText,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Text(
                          _formatDuration(video.duration),
                          style: TextStyle(
                            color: AppColors.goldText,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 16),

          // Start time picker
          const Text(
            'Start Time',
            style: TextStyle(
              color: AppColors.lightOrange,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: _pickDateTime,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _startDateTime != null
                          ? '${_startDateTime!.month}/${_startDateTime!.day}/${_startDateTime!.year}  ${_startDateTime!.hour.toString().padLeft(2, '0')}:${_startDateTime!.minute.toString().padLeft(2, '0')}'
                          : 'Tap to pick date & time',
                      style: TextStyle(
                        color: _startDateTime != null
                            ? AppColors.white
                            : AppColors.hintText,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.calendar_month,
                    color: AppColors.orange,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),

          // Chain preview
          if (_selectedVideos.isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.lightOrange.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: AppColors.lightOrange.withValues(alpha: 0.2),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${_selectedVideos.length} video${_selectedVideos.length > 1 ? 's' : ''} · Total: ${_formatDuration(totalDuration)}',
                    style: const TextStyle(
                      color: AppColors.lightOrange,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (endTime != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Ends: ${endTime.month}/${endTime.day} ${endTime.hour.toString().padLeft(2, '0')}:${endTime.minute.toString().padLeft(2, '0')}',
                      style: TextStyle(color: AppColors.goldText, fontSize: 12),
                    ),
                  ],
                ],
              ),
            ),
          ],

          // Error
          if (_error != null) ...[
            const SizedBox(height: 14),
            Text(
              _error!,
              style: const TextStyle(color: AppColors.errorRed, fontSize: 13),
            ),
          ],

          const SizedBox(height: 20),
          AppButton(
            label: _scheduling ? 'Scheduling...' : 'Schedule Queue',
            onPressed: _scheduling ? null : _schedule,
            loading: _scheduling,
          ),
        ],
      ),
    );
  }
}
