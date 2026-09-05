import 'dart:io';
import 'package:client/api/controllers/video_controller.dart' hide VideoController;
import 'package:client/components/button.dart';
import 'package:client/theme/theme_colors.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

class VideoUploadDialog extends ConsumerStatefulWidget {
  const VideoUploadDialog({super.key});

  @override
  ConsumerState<VideoUploadDialog> createState() => _VideoUploadDialogState();
}

class _VideoUploadDialogState extends ConsumerState<VideoUploadDialog> {
  final ImagePicker _picker = ImagePicker();
  final titleController = TextEditingController();
  final ValueNotifier<bool> _titleHasText = ValueNotifier(false);

  Player? _player;
  VideoController? _controller;

  File? _videoFile;
  Uint8List? _videoBytes;

  bool _picking = false;
  bool _loading = false;
  String? _fileName;

  double? _uploadProgress;

  @override
  void initState() {
    super.initState();
    titleController.addListener(() {
      _titleHasText.value = titleController.text.trim().isNotEmpty;
    });
  }

  @override
  void dispose() {
    titleController.dispose();
    _titleHasText.dispose();
    _player?.dispose();
    super.dispose();
  }

  Future<void> _pickVideo(ImageSource source) async {
    if (_picking) return;

    _picking = true;
    setState(() => _picking = true);

    try {
      final XFile? picked = await _picker.pickVideo(source: source, maxDuration: const Duration(minutes: 10)).timeout(const Duration(minutes: 2), onTimeout: () => null);
      if (!mounted) return;

      _picking = false;
      setState(() => _picking = false);

      if (picked == null) return;

      Uint8List? videoBytes;
      if (kIsWeb) videoBytes = await picked.readAsBytes();

      final file = File(picked.path);

      // Dispose previous player safely
      final oldPlayer = _player;
      final player = Player();
      final controller = VideoController(player);
      await player.open(Media(file.path));

      if (!mounted) {
        await player.dispose();
        return;
      }

      await _player?.dispose();

      setState(() {
        if (kIsWeb) {
          _videoBytes = videoBytes!;
        } else {
          _videoFile = file;
        }
        _player = player;
        _controller = controller;
      });

      await oldPlayer?.dispose();
    } finally {
      _picking = false;
    }
  }

  bool isButtonDisabled() => (_videoFile == null && _videoBytes == null) || titleController.text.trim().isEmpty;

  Future<void> _upload() async {
    if (isButtonDisabled()) return;

    setState(() {
      _loading = true;
      _uploadProgress = 0;
    });

    try {
      Response<dynamic> res;
      if (kIsWeb) {
        res = await ref
            .read(videoControllerProvider)
            .postForWeb(
              title: titleController.text.trim(),
              bytes: _videoBytes!,
              fileName: _fileName ?? titleController.text.trim(),
              onSendProgress: (sent, total) {
                if (!mounted || total <= 0) return;
                setState(() => _uploadProgress = sent / total);
              },
            );
      } else {
        res = await ref
            .read(videoControllerProvider)
            .post(
              title: titleController.text.trim(),
              file: _videoFile!,
              fileName: _fileName,
              onSendProgress: (sent, total) {
                if (!mounted || total <= 0) return;
                setState(() => _uploadProgress = sent / total);
              },
            );
      }
      if (res.statusCode == null || res.statusCode! < 200 || res.statusCode! > 299) return;
      if (!mounted) return;

      Navigator.pop(context, res.data['id']);
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _uploadProgress = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.all(20),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 600),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_uploadProgress != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(value: _uploadProgress! > 0 ? _uploadProgress : null, minHeight: 6),
                ),
                const SizedBox(height: 12),
              ],

              const Text("Upload Video", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),

              const SizedBox(height: 16),

              TextField(
                controller: titleController,
                decoration: const InputDecoration(labelText: 'Title'),
                onChanged: (_) => setState(() {}),
              ),

              const SizedBox(height: 16),

              // Preview
              Container(
                height: 260,
                width: double.infinity,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: _controller == null
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [_picking ? SizedBox(height: 40, width: 40, child: CircularProgressIndicator(strokeWidth: 2)) : const Center(child: Text('No video selected'))],
                      )
                    : ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Video(controller: _controller!, fit: BoxFit.contain),
                      ),
              ),

              const SizedBox(height: 16),

              // Pick buttons
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  TextButton.icon(onPressed: _loading ? null : () => _pickVideo(ImageSource.gallery), icon: const Icon(Icons.video_library), label: const Text("Gallery")),

                  TextButton.icon(onPressed: _loading ? null : () => _pickVideo(ImageSource.camera), icon: const Icon(Icons.videocam), label: const Text("Camera")),
                ],
              ),

              const SizedBox(height: 16),

              // Actions
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(onPressed: _loading ? null : () => Navigator.pop(context), child: const Text("Cancel")),

                  const SizedBox(width: 8),

                  ValueListenableBuilder<bool>(
                    valueListenable: _titleHasText,
                    builder: (context, hasText, _) {
                      return Button(type: ButtonType.elevated, color: ThemeColorName.secondary, onPressed: isButtonDisabled() ? null : _upload, isLoading: _loading, label: "Upload");
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
