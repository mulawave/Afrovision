import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/api/api_service.dart';
import '../services/guardian_service.dart';

class GuardianFormScreen extends StatefulWidget {
  const GuardianFormScreen({super.key});

  @override
  State<GuardianFormScreen> createState() => _GuardianFormScreenState();
}

class _GuardianFormScreenState extends State<GuardianFormScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fade;
  late Animation<Offset> _slide;

  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _idNumberCtrl = TextEditingController();
  final _accountUidCtrl = TextEditingController();
  final _signatureCtrl = TextEditingController();

  String _relationship = 'parent';
  String _guardianIdType = 'national_id';
  bool _linkExistingAccount = false;
  bool _submitting = false;
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _existing;

  String? _idFrontUrl;
  String? _idBackUrl;
  String? _selfieUrl;
  String? _uploadingField;

  final _relationships = const [
    {'value': 'parent', 'label': 'Parent'},
    {'value': 'legal_guardian', 'label': 'Legal Guardian'},
    {'value': 'sibling', 'label': 'Sibling'},
    {'value': 'relative', 'label': 'Relative'},
    {'value': 'other', 'label': 'Other'},
  ];

  final _idTypes = const [
    {'value': 'national_id', 'label': 'National ID Card'},
    {'value': 'international_passport', 'label': 'International Passport'},
    {'value': 'drivers_license', 'label': "Driver's License"},
    {'value': 'voters_card', 'label': "Voter's Card"},
    {'value': 'nin_slip', 'label': 'NIN Slip'},
    {'value': 'residence_permit', 'label': 'Residence Permit'},
  ];

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fade = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.04),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _loadExisting();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _idNumberCtrl.dispose();
    _accountUidCtrl.dispose();
    _signatureCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadExisting() async {
    try {
      final data = await GuardianService.getMine();
      if (data != null && data['id'] != null && mounted) {
        setState(() => _existing = data);
      }
    } catch (_) {}
    if (mounted) {
      setState(() => _loading = false);
      _animCtrl.forward();
    }
  }

  Future<void> _uploadFile(String fieldName) async {
    final picker = ImagePicker();
    final XFile? file;
    if (fieldName == 'selfie') {
      file = await picker.pickImage(source: ImageSource.camera);
    } else {
      file = await picker.pickImage(source: ImageSource.gallery);
    }
    if (file == null) return;

    setState(() {
      _uploadingField = fieldName;
      _error = null;
    });

    try {
      final data = await ApiService.uploadFile(
        '/kyc/upload-doc',
        File(file.path),
        fieldName: 'file',
      );
      if (!mounted) return;
      final url = data['url'] as String?;
      if (url != null) {
        setState(() {
          if (fieldName == 'guardian_id_front') _idFrontUrl = url;
          if (fieldName == 'guardian_id_back') _idBackUrl = url;
          if (fieldName == 'guardian_selfie') _selfieUrl = url;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = 'Upload failed');
    } finally {
      if (mounted) setState(() => _uploadingField = null);
    }
  }

  Future<void> _submit() async {
    final name = _nameCtrl.text.trim();
    final email = _emailCtrl.text.trim();
    final phone = _phoneCtrl.text.trim();
    final signature = _signatureCtrl.text.trim();

    if (name.isEmpty) {
      setState(() => _error = 'Guardian full name is required');
      return;
    }
    if (email.isEmpty) {
      setState(() => _error = 'Guardian email is required');
      return;
    }
    if (phone.isEmpty) {
      setState(() => _error = 'Guardian phone number is required');
      return;
    }
    if (signature.isEmpty) {
      setState(() => _error = 'Consent signature is required');
      return;
    }

    if (_linkExistingAccount) {
      final uid = _accountUidCtrl.text.trim();
      if (uid.isEmpty) {
        setState(() => _error = 'Guardian account UID is required');
        return;
      }
    } else {
      if (_idNumberCtrl.text.trim().isEmpty) {
        setState(() => _error = 'Guardian ID number is required');
        return;
      }
      if (_idFrontUrl == null) {
        setState(() => _error = 'Guardian ID front image is required');
        return;
      }
      if (_selfieUrl == null) {
        setState(() => _error = 'Guardian selfie photo is required');
        return;
      }
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final body = <String, dynamic>{
        'guardian_full_name': name,
        'guardian_email': email,
        'guardian_phone': phone,
        'guardian_relationship': _relationship,
        'guardian_address': _addressCtrl.text.trim().isNotEmpty
            ? _addressCtrl.text.trim()
            : null,
        'consent_declaration': true,
        'consent_signature': signature,
      };

      if (_linkExistingAccount) {
        body['guardian_account_uid'] = _accountUidCtrl.text.trim();
      } else {
        body['guardian_id_type'] = _guardianIdType;
        body['guardian_id_number'] = _idNumberCtrl.text.trim();
        body['guardian_id_front_url'] = _idFrontUrl;
        body['guardian_selfie_url'] = _selfieUrl;
        if (_idBackUrl != null) body['guardian_id_back_url'] = _idBackUrl;
      }

      await GuardianService.submit(body);
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Guardian form submitted! Pending review.',
            style: TextStyle(color: AppColors.white),
          ),
          backgroundColor: const Color(0xFF5FD39A).withValues(alpha: 0.9),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
      Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
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
          child: Column(
            children: [
              _buildHeader(),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.orange,
                          ),
                        ),
                      )
                    : _existing != null
                        ? _buildExistingView()
                        : FadeTransition(
                            opacity: _fade,
                            child: SlideTransition(
                              position: _slide,
                              child: _buildForm(),
                            ),
                          ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.arrow_back_rounded,
                color: AppColors.white,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Text(
              'Guardian Consent Form',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExistingView() {
    final status = _existing!['status'] as String? ?? 'pending';
    final colors = {
      'pending': AppColors.lightOrange,
      'verified': const Color(0xFF5FD39A),
      'rejected': Colors.red[400]!,
    };
    final labels = {
      'pending': 'Pending Review',
      'verified': 'Verified',
      'rejected': 'Rejected',
    };

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: (colors[status] ?? AppColors.orange).withValues(alpha: 0.15),
              ),
              child: Icon(
                status == 'verified'
                    ? Icons.verified_rounded
                    : status == 'rejected'
                        ? Icons.cancel_rounded
                        : Icons.hourglass_top_rounded,
                color: colors[status] ?? AppColors.orange,
                size: 48,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              labels[status] ?? status.toUpperCase(),
              style: TextStyle(
                color: colors[status] ?? AppColors.white,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              status == 'verified'
                  ? 'Your guardian consent has been approved.'
                  : status == 'rejected'
                      ? 'Your guardian form was rejected. Please submit a new one.'
                      : 'Your guardian form is under review.\nThis usually takes 1-2 business days.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.goldText, fontSize: 13, height: 1.5),
            ),
            if (status == 'rejected') ...[
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton(
                  onPressed: () => setState(() => _existing = null),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.orange,
                    foregroundColor: AppColors.darkBlue,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
                    elevation: 0,
                  ),
                  child: const Text('Submit New Form', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: AppColors.orange.withValues(alpha: 0.08),
              border: Border.all(color: AppColors.orange.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline_rounded, color: AppColors.orange, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'As a guardian, please provide your details and ID to verify consent for this minor user.',
                    style: TextStyle(color: AppColors.goldText, fontSize: 11, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (_error != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: Colors.red.withValues(alpha: 0.1),
                border: Border.all(color: Colors.red.withValues(alpha: 0.2)),
              ),
              child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
            ),
            const SizedBox(height: 16),
          ],
          _sectionCard('Guardian Information', [
            _field('Full Name *', _nameCtrl, 'Guardian full name'),
            _field('Email *', _emailCtrl, 'guardian@email.com'),
            _field('Phone *', _phoneCtrl, '+234...'),
            _relationshipSelector(),
            _field('Address', _addressCtrl, 'Residential address'),
          ]),
          const SizedBox(height: 16),
          _sectionCard('Verification Method', [
            SwitchListTile(
              title: Text(
                'Link existing AfroVision account',
                style: TextStyle(color: AppColors.white, fontSize: 13),
              ),
              subtitle: Text(
                'If guardian has an existing verified account',
                style: TextStyle(color: AppColors.goldText, fontSize: 11),
              ),
              value: _linkExistingAccount,
              activeThumbColor: AppColors.orange,
              onChanged: (val) => setState(() => _linkExistingAccount = val),
            ),
            if (_linkExistingAccount)
              _field('Guardian Account UID *', _accountUidCtrl, 'Enter AfroVision UID')
            else ...[
              _idTypeSelector(),
              _field('ID Number *', _idNumberCtrl, 'Guardian ID number'),
              const SizedBox(height: 8),
              _uploadBox('ID Front *', 'guardian_id_front', _idFrontUrl),
              _uploadBox('ID Back (optional)', 'guardian_id_back', _idBackUrl),
              _uploadBox('Selfie Photo *', 'guardian_selfie', _selfieUrl,
                  hint: 'Clear selfie matching guardian ID'),
            ],
          ]),
          const SizedBox(height: 16),
          _sectionCard('Consent Declaration', [
            Text(
              'I, the undersigned, declare that I am the parent/legal guardian of this user and give consent for them to use the AfroVision platform with restricted access as a minor.',
              style: TextStyle(color: AppColors.goldText, fontSize: 11, height: 1.5),
            ),
            const SizedBox(height: 12),
            _field('Type your full name as signature *', _signatureCtrl, 'Your full name'),
          ]),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _submitting || _uploadingField != null ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.orange,
                foregroundColor: AppColors.darkBlue,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25)),
                elevation: 0,
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(AppColors.darkBlue),
                      ),
                    )
                  : const Text('Submit Guardian Form', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionCard(String title, List<Widget> children) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: AppColors.inputFill.withValues(alpha: 0.3),
        border: Border.all(color: AppColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: AppColors.white, fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl, String placeholder) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(color: AppColors.goldText, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.3),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: ctrl,
            style: const TextStyle(color: AppColors.white, fontSize: 14),
            decoration: InputDecoration(
              hintText: placeholder,
              hintStyle: TextStyle(color: AppColors.goldText, fontSize: 13),
              filled: true,
              fillColor: AppColors.inputFill.withValues(alpha: 0.5),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.inputBorder),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.inputBorder),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.orange.withValues(alpha: 0.5)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _relationshipSelector() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Relationship *', style: TextStyle(color: AppColors.goldText, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.3)),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              color: AppColors.inputFill.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _relationship,
                isExpanded: true,
                dropdownColor: AppColors.darkBlue,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                style: const TextStyle(color: AppColors.white, fontSize: 14),
                items: _relationships.map((r) => DropdownMenuItem(value: r['value'], child: Text(r['label']!))).toList(),
                onChanged: (val) { if (val != null) setState(() => _relationship = val); },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _idTypeSelector() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('ID Type *', style: TextStyle(color: AppColors.goldText, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.3)),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              color: AppColors.inputFill.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.inputBorder),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _guardianIdType,
                isExpanded: true,
                dropdownColor: AppColors.darkBlue,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                style: const TextStyle(color: AppColors.white, fontSize: 14),
                items: _idTypes.map((t) => DropdownMenuItem(value: t['value'], child: Text(t['label']!))).toList(),
                onChanged: (val) { if (val != null) setState(() => _guardianIdType = val); },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _uploadBox(String label, String fieldName, String? uploadedUrl, {String? hint}) {
    final isUploading = _uploadingField == fieldName;
    final isUploaded = uploadedUrl != null;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GestureDetector(
        onTap: isUploading ? null : () => _uploadFile(fieldName),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isUploaded ? const Color(0xFF5FD39A).withValues(alpha: 0.3) : AppColors.inputBorder,
            ),
            color: isUploaded ? const Color(0xFF5FD39A).withValues(alpha: 0.05) : AppColors.inputFill.withValues(alpha: 0.2),
          ),
          child: isUploading
              ? const Center(child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange))))
              : Row(
                  children: [
                    Icon(isUploaded ? Icons.check_circle_rounded : Icons.upload_rounded,
                        color: isUploaded ? const Color(0xFF5FD39A) : AppColors.goldText, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(label, style: TextStyle(color: AppColors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                          if (hint != null)
                            Text(hint, style: TextStyle(color: AppColors.goldText, fontSize: 10)),
                          if (isUploaded)
                            Text('Uploaded', style: TextStyle(color: const Color(0xFF5FD39A), fontSize: 10)),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
