import 'package:flutter/material.dart';
import 'package:afrovision_marketer/core/theme/app_colors.dart';
import 'package:afrovision_marketer/core/services/api_service.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> with SingleTickerProviderStateMixin {
  List<dynamic>? _codes;
  bool _isLoading = true;
  String? _error;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(vsync: this, duration: Duration(milliseconds: 400));
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeIn);
    _loadCodes();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadCodes() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final data = await ApiService.listCodes();
      if (data['success'] == true) {
        _codes = data['codes'] as List<dynamic>?;
        _animController.forward();
      } else {
        _error = (data['message'] as String?) ?? (data['error'] as String?) ?? 'Failed to load history';
      }
    } catch (e) {
      _error = 'Network error. Pull to retry.';
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(),
              Expanded(
                child: _isLoading
                    ? Center(child: CircularProgressIndicator(color: AppColors.orange))
                    : _error != null
                        ? _buildErrorView()
                        : _codes == null || _codes!.isEmpty
                            ? _buildEmptyView()
                            : FadeTransition(
                                opacity: _fadeAnim,
                                child: RefreshIndicator(
                                  onRefresh: _loadCodes,
                                  color: AppColors.orange,
                                  child: ListView.builder(
                                    padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                                    itemCount: _codes!.length,
                                    itemBuilder: (ctx, i) => _buildCodeCard(_codes![i] as Map<String, dynamic>),
                                  ),
                                ),
                              ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: Icon(Icons.arrow_back, color: AppColors.white, size: 24),
          ),
          Text('Code History', style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          Spacer(),
          if (_codes != null)
            Text('${_codes!.length}', style: TextStyle(color: AppColors.lightOrange, fontSize: 14, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildErrorView() {
    return ListView(
      children: [
        SizedBox(height: 200),
        Center(
          child: Container(
            margin: EdgeInsets.symmetric(horizontal: 28),
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.errorRed.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.3)),
            ),
            child: Text(_error!, style: TextStyle(color: AppColors.errorRed, fontSize: 13), textAlign: TextAlign.center),
          ),
        ),
        SizedBox(height: 16),
        Center(
          child: TextButton(
            onPressed: _loadCodes,
            child: Text('Retry', style: TextStyle(color: AppColors.orange)),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyView() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.history_toggle_off, color: AppColors.hintText, size: 56),
          SizedBox(height: 16),
          Text('No codes yet', style: TextStyle(color: AppColors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          Text('Request your first activation code', style: TextStyle(color: AppColors.hintText, fontSize: 13)),
        ],
      ),
    );
  }

  Widget _buildCodeCard(Map<String, dynamic> code) {
    final status = code['status'] as String? ?? 'unknown';
    final codeStr = code['code'] as String? ?? '—';
    final issuedAt = code['issued_at'] as String?;
    final activatedAt = code['activated_at'] as String?;
    final deviceId = code['device_id'] as String?;

    final isUsed = status == 'used' || status == 'activated';
    final accentColor = isUsed ? AppColors.successGreen : AppColors.orange;

    return Container(
      margin: EdgeInsets.only(bottom: 12),
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accentColor.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                codeStr,
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                  letterSpacing: 1,
                ),
              ),
              _statusChip(status, accentColor),
            ],
          ),
          SizedBox(height: 12),
          Row(
            children: [
              _detailItem('Issued', _formatDate(issuedAt)),
              SizedBox(width: 20),
              if (activatedAt != null)
                _detailItem('Activated', _formatDate(activatedAt))
              else
                _detailItem('Activated', '—'),
            ],
          ),
          if (deviceId != null && deviceId.isNotEmpty) ...[
            SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.tv, color: AppColors.hintText, size: 14),
                SizedBox(width: 6),
                Text(
                  'Device: ${_truncate(deviceId)}',
                  style: TextStyle(color: AppColors.hintText, fontSize: 11, fontFamily: 'monospace'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _statusChip(String status, Color color) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5),
      ),
    );
  }

  Widget _detailItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: AppColors.hintText, fontSize: 10, fontWeight: FontWeight.w500)),
        SizedBox(height: 2),
        Text(value, style: TextStyle(color: AppColors.lightOrange, fontSize: 12)),
      ],
    );
  }

  String _formatDate(String? iso) {
    if (iso == null) return '—';
    try {
      final d = DateTime.parse(iso);
      return '${d.day}/${d.month}/${d.year}';
    } catch (_) {
      return iso;
    }
  }

  String _truncate(String s) {
    if (s.length <= 16) return s;
    return '${s.substring(0, 8)}...${s.substring(s.length - 4)}';
  }
}
