import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_text_field.dart';
import '../services/channel_library_creator_service.dart';

const Color _screenBg = Color(0xFF08091A);
const Color _cardBg = Color(0xFF0C0D22);
const Color _readingBg = Color(0xFF0E0A04);
const Color _hairline = Color(0x12FFFFFF);

class ReadableUploadScreen extends StatefulWidget {
  const ReadableUploadScreen({super.key});

  @override
  State<ReadableUploadScreen> createState() => _ReadableUploadScreenState();
}

class _ReadableUploadScreenState extends State<ReadableUploadScreen>
    with SingleTickerProviderStateMixin {
  String? _channelId;
  bool _argsHandled = false;
  bool _loading = true;
  bool _saving = false;
  bool _loadingSeries = false;
  String? _error;
  String? _actionError;

  final _titleController = TextEditingController();
  final _authorController = TextEditingController();
  final _descriptionController = TextEditingController();

  late final AnimationController _animCtrl;
  late final Animation<double> _fadeAnim;
  late final Animation<Offset> _slideAnim;

  List<CreatorLibrarySeriesModel> _series = <CreatorLibrarySeriesModel>[];
  String? _selectedSeriesId;

  String _contentType = 'book';
  String _contentMode = 'pdf';

  File? _coverFile;
  File? _contentPdfFile;
  List<File> _contentPageFiles = <File>[];

  bool _uploadingCover = false;
  bool _uploadingContent = false;
  double _coverProgress = 0;
  double _contentProgress = 0;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 560),
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_argsHandled) return;
    _argsHandled = true;

    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is String) {
      _channelId = args;
    } else if (args is Map) {
      _channelId = (args['channelId'] ?? args['id'])?.toString();
    }

    if (_channelId == null || _channelId!.isEmpty) {
      setState(() {
        _error = 'No channel selected.';
        _loading = false;
      });
      _animCtrl.forward();
      return;
    }

    _loadSeries();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _authorController.dispose();
    _descriptionController.dispose();
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadSeries() async {
    if (_channelId == null) return;
    setState(() {
      _loadingSeries = true;
      _error = null;
    });

    try {
      final series = await ChannelLibraryCreatorService.getSeries(_channelId!);
      if (!mounted) return;
      setState(() {
        _series = series;
        _loading = false;
        _loadingSeries = false;
        if (_selectedSeriesId != null &&
            !_series.any((entry) => entry.id == _selectedSeriesId)) {
          _selectedSeriesId = null;
        }
      });
      _animCtrl.forward(from: 0);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadingSeries = false;
        _error = 'Could not load series. You can still create a readable.';
      });
      _animCtrl.forward(from: 0);
    }
  }

  Future<void> _createSeries() async {
    if (_channelId == null) return;

    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    bool saving = false;

    final created = await showModalBottomSheet<CreatorLibrarySeriesModel>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            Future<void> submit() async {
              final title = titleCtrl.text.trim();
              if (title.isEmpty) {
                return;
              }
              setModalState(() => saving = true);
              try {
                final series = await ChannelLibraryCreatorService.createSeries(
                  _channelId!,
                  title: title,
                  description: descCtrl.text.trim().isNotEmpty
                      ? descCtrl.text.trim()
                      : null,
                );
                if (!ctx.mounted) return;
                Navigator.pop(ctx, series);
              } catch (e) {
                if (!ctx.mounted) return;
                setModalState(() => saving = false);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      e.toString(),
                      style: const TextStyle(color: AppColors.white),
                    ),
                    backgroundColor: AppColors.errorRed.withValues(alpha: 0.9),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              }
            }

            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: _cardBg,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: _hairline),
                ),
                child: SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Create series',
                                style: TextStyle(
                                  color: AppColors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            IconButton(
                              onPressed: saving
                                  ? null
                                  : () => Navigator.pop(ctx),
                              icon: const Icon(
                                Icons.close_rounded,
                                color: AppColors.hintText,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        AppTextField(
                          controller: titleCtrl,
                          label: 'Series title',
                          hint: 'e.g. The Lagos Diaries',
                        ),
                        const SizedBox(height: 14),
                        AppTextField(
                          controller: descCtrl,
                          label: 'Description',
                          hint: 'Optional series description',
                        ),
                        const SizedBox(height: 18),
                        AppButton(
                          label: saving ? 'Creating...' : 'Create Series',
                          onPressed: saving ? null : submit,
                          loading: saving,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );

    titleCtrl.dispose();
    descCtrl.dispose();

    if (created != null && mounted) {
      setState(() {
        _series.insert(0, created);
        _selectedSeriesId = created.id;
      });
      _showToast('Series created');
    }
  }

  Future<void> _pickCover() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      allowMultiple: false,
    );
    if (result == null || result.files.isEmpty || result.files.first.path == null) {
      return;
    }
    setState(() {
      _coverFile = File(result.files.first.path!);
      _actionError = null;
    });
  }

  Future<void> _pickPdf() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf'],
      allowMultiple: false,
    );
    if (result == null || result.files.isEmpty || result.files.first.path == null) {
      return;
    }
    setState(() {
      _contentPdfFile = File(result.files.first.path!);
      _contentPageFiles = <File>[];
      _contentMode = 'pdf';
      _actionError = null;
    });
  }

  Future<void> _pickPageImages() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp'],
      allowMultiple: true,
    );
    if (result == null || result.files.isEmpty) return;

    final files = <File>[];
    for (final file in result.files) {
      if (file.path != null) {
        files.add(File(file.path!));
      }
    }
    if (files.isEmpty) return;

    setState(() {
      _contentPageFiles = files;
      _contentPdfFile = null;
      _contentMode = 'images';
      _actionError = null;
    });
  }

  String _extensionOf(File file) {
    final name = file.path.split('/').last;
    final idx = name.lastIndexOf('.');
    return idx >= 0 ? name.substring(idx + 1).toLowerCase() : '';
  }

  String _contentTypeForFile(File file) {
    final ext = _extensionOf(file);
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  Future<String> _uploadFile({
    required File file,
    required String assetType,
    required String contentType,
    required void Function(double progress) onProgress,
  }) async {
    final upload = await ChannelLibraryCreatorService.getUploadUrl(
      channelId: _channelId!,
      assetType: assetType,
      contentType: contentType,
      fileName: file.path.split('/').last,
    );

    await ChannelLibraryCreatorService.uploadToGcs(
      signedUrl: upload['signed_url']!,
      file: file,
      contentType: contentType,
      onProgress: (sent, total) {
        if (!mounted) return;
        onProgress(total == 0 ? 0 : sent / total);
      },
    );

    return upload['public_url']!;
  }

  Future<void> _submit({required bool publish}) async {
    if (_channelId == null) return;

    final title = _titleController.text.trim();
    final author = _authorController.text.trim();
    final description = _descriptionController.text.trim();

    if (title.isEmpty) {
      setState(() => _actionError = 'Title is required.');
      return;
    }
    if (author.isEmpty) {
      setState(() => _actionError = 'Author is required.');
      return;
    }
    if (publish && _contentPdfFile == null && _contentPageFiles.isEmpty) {
      setState(() => _actionError = 'Add a PDF or page images before publishing.');
      return;
    }

    setState(() {
      _saving = true;
      _actionError = null;
      _uploadingCover = _coverFile != null;
      _uploadingContent = _contentPdfFile != null || _contentPageFiles.isNotEmpty;
      _coverProgress = 0;
      _contentProgress = 0;
    });

    try {
      String? coverUrl;
      if (_coverFile != null) {
        coverUrl = await _uploadFile(
          file: _coverFile!,
          assetType: 'cover',
          contentType: _contentTypeForFile(_coverFile!),
          onProgress: (value) {
            if (!mounted) return;
            setState(() => _coverProgress = value);
          },
        );
      }

      CreatorLibraryManifestModel? manifest;
      if (_contentPdfFile != null) {
        final pdfUrl = await _uploadFile(
          file: _contentPdfFile!,
          assetType: 'reader_pdf',
          contentType: _contentTypeForFile(_contentPdfFile!),
          onProgress: (value) {
            if (!mounted) return;
            setState(() => _contentProgress = value);
          },
        );
        manifest = await ChannelLibraryCreatorService.generateManifest(
          _channelId!,
          pdfUrl: pdfUrl,
        );
      } else if (_contentPageFiles.isNotEmpty) {
        final pageUrls = <String>[];
        for (var index = 0; index < _contentPageFiles.length; index++) {
          final file = _contentPageFiles[index];
          final publicUrl = await _uploadFile(
            file: file,
            assetType: 'reader_page',
            contentType: _contentTypeForFile(file),
            onProgress: (value) {
              if (!mounted) return;
              final perFile = (index + value) / _contentPageFiles.length;
              setState(() => _contentProgress = perFile.clamp(0, 1).toDouble());
            },
          );
          pageUrls.add(publicUrl);
        }
        manifest = await ChannelLibraryCreatorService.generateManifest(
          _channelId!,
          pageImageUrls: pageUrls,
        );
      }

      await ChannelLibraryCreatorService.createItem(
        _channelId!,
        title: title,
        author: author,
        description: description.isNotEmpty ? description : null,
        contentType: _contentType,
        totalPages: manifest?.totalPages ?? 0,
        coverAssetUrl: coverUrl,
        readerAssetManifestUrl: manifest?.manifestUrl,
        seriesId: _selectedSeriesId,
        status: publish ? 'published' : 'draft',
      );

      if (!mounted) return;
      _showToast(publish ? 'Readable published' : 'Draft saved');
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _actionError = e.toString());
      _showToast(e.toString(), error: true);
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
          _uploadingCover = false;
          _uploadingContent = false;
        });
      }
    }
  }

  void _showToast(String message, {bool error = false}) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: const Color(0xFF0C0D22),
        margin: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        shape: StadiumBorder(
          side: BorderSide(
            color: error
                ? AppColors.errorRed.withValues(alpha: 0.7)
                : AppColors.orange.withValues(alpha: 0.6),
          ),
        ),
        content: Text(
          message,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: error ? AppColors.errorRed : AppColors.lightOrange,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, {Widget? action}) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        if (action != null) action,
      ],
    );
  }

  Widget _buildChip(
    String label, {
    required bool selected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? AppColors.orange.withValues(alpha: 0.14) : _readingBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected
                ? AppColors.orange.withValues(alpha: 0.3)
                : _hairline,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? AppColors.lightOrange : AppColors.hintText,
            fontWeight: FontWeight.w700,
            fontSize: 12,
          ),
        ),
      ),
    );
  }

  Widget _buildCoverPreview() {
    final hasCover = _coverFile != null;
    return GestureDetector(
      onTap: _saving ? null : _pickCover,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _readingBg,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: _hairline),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Container(
                width: 78,
                height: 104,
                color: AppColors.inputFill,
                child: hasCover
                    ? Image.file(
                        _coverFile!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const Icon(
                          Icons.image_rounded,
                          color: AppColors.hintText,
                        ),
                      )
                    : const Icon(
                        Icons.add_photo_alternate_outlined,
                        color: AppColors.hintText,
                      ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Cover image',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    hasCover
                        ? _coverFile!.path.split('/').last
                        : 'Tap to choose a JPG, PNG, WebP, or GIF',
                    style: const TextStyle(
                      color: AppColors.hintText,
                      fontSize: 12,
                      height: 1.4,
                    ),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (_uploadingCover) ...[
                    const SizedBox(height: 10),
                    LinearProgressIndicator(
                      value: _coverProgress,
                      minHeight: 6,
                      backgroundColor: Colors.white.withValues(alpha: 0.08),
                      valueColor: const AlwaysStoppedAnimation<Color>(
                        AppColors.orange,
                      ),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContentPicker() {
    final hasPdf = _contentPdfFile != null;
    final hasImages = _contentPageFiles.isNotEmpty;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _readingBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionHeader(
            'Content',
            action: Text(
              _contentMode == 'pdf' ? 'PDF mode' : 'Image mode',
              style: const TextStyle(
                color: AppColors.lightOrange,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildChip(
                  'Single PDF',
                  selected: _contentMode == 'pdf',
                  onTap: () => setState(() => _contentMode = 'pdf'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildChip(
                  'Page images',
                  selected: _contentMode == 'images',
                  onTap: () => setState(() => _contentMode = 'images'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (_contentMode == 'pdf')
            GestureDetector(
              onTap: _saving ? null : _pickPdf,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.inputFill,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _hairline),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.picture_as_pdf_rounded,
                      color: AppColors.lightOrange,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        hasPdf
                            ? _contentPdfFile!.path.split('/').last
                            : 'Tap to choose a PDF file',
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            GestureDetector(
              onTap: _saving ? null : _pickPageImages,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.inputFill,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _hairline),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.collections_rounded,
                      color: AppColors.lightOrange,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        hasImages
                            ? '${_contentPageFiles.length} page images selected'
                            : 'Tap to choose page images',
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (hasPdf || hasImages) ...[
            const SizedBox(height: 10),
            Text(
              hasPdf
                  ? 'PDF upload selected.'
                  : 'Images upload selected. Files will be sent one by one.',
              style: const TextStyle(
                color: AppColors.hintText,
                fontSize: 12,
              ),
            ),
          ],
          if (_uploadingContent) ...[
            const SizedBox(height: 10),
            LinearProgressIndicator(
              value: _contentProgress,
              minHeight: 6,
              backgroundColor: Colors.white.withValues(alpha: 0.08),
              valueColor: const AlwaysStoppedAnimation<Color>(
                AppColors.orange,
              ),
              borderRadius: BorderRadius.circular(999),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSeriesPicker() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _readingBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionHeader(
            'Series',
            action: GestureDetector(
              onTap: _saving ? null : _createSeries,
              child: const Text(
                '+ New series',
                style: TextStyle(
                  color: AppColors.lightOrange,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _selectedSeriesId ?? '',
            dropdownColor: _cardBg,
            decoration: InputDecoration(
              filled: true,
              fillColor: AppColors.inputFill,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.inputBorder),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.inputBorder),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.orange),
              ),
            ),
            hint: const Text('No series selected'),
            items: [
              const DropdownMenuItem<String>(
                value: '',
                child: Text('No series selected'),
              ),
              ..._series.map(
                (series) => DropdownMenuItem<String>(
                  value: series.id,
                  child: Text(series.title),
                ),
              ),
            ],
            onChanged: _saving
                ? null
                : (value) => setState(
                    () => _selectedSeriesId =
                        (value == null || value.isEmpty) ? null : value,
                  ),
            style: const TextStyle(color: AppColors.white),
          ),
          if (_loadingSeries) ...[
            const SizedBox(height: 10),
            const LinearProgressIndicator(
              minHeight: 3,
              backgroundColor: Colors.transparent,
              valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMetadataCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _readingBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionHeader('Metadata'),
          const SizedBox(height: 12),
          AppTextField(
            controller: _titleController,
            label: 'Title',
            hint: 'Readable title',
          ),
          const SizedBox(height: 14),
          AppTextField(
            controller: _authorController,
            label: 'Author',
            hint: 'Author or creator name',
          ),
          const SizedBox(height: 14),
          AppTextField(
            controller: _descriptionController,
            label: 'Description',
            hint: 'Optional description',
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _buildChip(
                'Book',
                selected: _contentType == 'book',
                onTap: () => setState(() => _contentType = 'book'),
              ),
              _buildChip(
                'Comic',
                selected: _contentType == 'comic',
                onTap: () => setState(() => _contentType = 'comic'),
              ),
              _buildChip(
                'Magazine',
                selected: _contentType == 'magazine',
                onTap: () => setState(() => _contentType = 'magazine'),
              ),
              _buildChip(
                'Other',
                selected: _contentType == 'other',
                onTap: () => setState(() => _contentType = 'other'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionBar() {
    final busy = _saving;
    return Row(
      children: [
        Expanded(
          child: AppButton(
            label: 'Save Draft',
            loading: busy,
            onPressed: busy ? null : () => _submit(publish: false),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: AppButton(
            label: 'Publish',
            loading: busy,
            onPressed: busy ? null : () => _submit(publish: true),
          ),
        ),
      ],
    );
  }

  Widget _buildErrorState(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: AppColors.errorRed,
              size: 50,
            ),
            const SizedBox(height: 16),
            const Text(
              'Readable upload unavailable',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: const TextStyle(color: AppColors.hintText, fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            AppButton(label: 'Retry', onPressed: _loadSeries),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
          ),
          SizedBox(height: 14),
          Text(
            'Opening your reader…',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildForm() {
    final hasFiles = _contentPdfFile != null || _contentPageFiles.isNotEmpty;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      children: [
        if (_actionError != null) ...[
          Container(
            padding: const EdgeInsets.all(14),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: AppColors.errorRed.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppColors.errorRed.withValues(alpha: 0.25),
              ),
            ),
            child: Text(
              _actionError!,
              style: const TextStyle(
                color: AppColors.errorRed,
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ),
        ],
        FadeTransition(
          opacity: _fadeAnim,
          child: SlideTransition(
            position: _slideAnim,
            child: Column(
              children: [
                _buildCoverPreview(),
                const SizedBox(height: 14),
                _buildMetadataCard(),
                const SizedBox(height: 14),
                _buildContentPicker(),
                const SizedBox(height: 14),
                _buildSeriesPicker(),
                const SizedBox(height: 16),
                _buildActionBar(),
                const SizedBox(height: 12),
                Text(
                  hasFiles
                      ? 'Total pages will be generated from your upload.'
                      : 'You can save a draft without content, or add a PDF/page set before publishing.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.hintText,
                    fontSize: 12,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _screenBg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: _saving ? null : () => Navigator.pop(context),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: _cardBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: _hairline),
                      ),
                      child: const Icon(
                        Icons.arrow_back_ios_new_rounded,
                        color: AppColors.white,
                        size: 18,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Text(
                      'Create Readable',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? _buildLoadingState()
                  : _error != null
                      ? _buildErrorState(_error!)
                      : RefreshIndicator(
                          color: AppColors.orange,
                          backgroundColor: _cardBg,
                          onRefresh: _loadSeries,
                          child: _buildForm(),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
