import 'dart:io';
import 'package:client/api/image_controller.dart';
import 'package:client/components/button.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:client/theme/theme_mode_notifier.dart';

class ImageUploadDialog extends ConsumerStatefulWidget {
  const ImageUploadDialog({super.key});

  @override
  ConsumerState<ImageUploadDialog> createState() => _ImageUploadDialogState();
}

class _ImageUploadDialogState extends ConsumerState<ImageUploadDialog> {
  final titleController = TextEditingController();
  File? _image;
  bool _loading = false;

  @override
  void dispose() {
    titleController.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();

    final XFile? picked = await picker.pickImage(source: source, imageQuality: 85);

    if (picked == null) return;

    setState(() {
      _image = File(picked.path);
    });
  }

  bool isButtonDisabled() => _image == null || titleController.text.trim().isEmpty;

  Future<void> _upload() async {
    if (isButtonDisabled()) return;

    setState(() => _loading = true);

    try {
      Response<dynamic> res = await ref.read(imageControllerProvider).post(title: titleController.text.trim(), file: _image!);
      if (res.statusCode == null || res.statusCode! < 200 || res.statusCode! > 299) return;
      if (!mounted) return;

      Navigator.pop(context, res.data['id']);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    return Dialog(
      insetPadding: const EdgeInsets.all(20),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text("Upload Image", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),

              const SizedBox(height: 16),

              TextField(
                controller: titleController,
                decoration: const InputDecoration(labelText: 'Title'),
                onChanged: (_) => setState(() {}),
              ),

              const SizedBox(height: 16),

              // Preview
              Container(
                height: 200,
                width: double.infinity,
                decoration: BoxDecoration(
                  border: Border.all(color: theme.outline),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: _image == null
                    ? const Center(child: Text("No image selected"))
                    : ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.file(_image!, fit: BoxFit.fitWidth),
                      ),
              ),

              const SizedBox(height: 16),

              // Buttons: pick image
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  TextButton.icon(onPressed: () => _pickImage(ImageSource.gallery), icon: const Icon(Icons.photo), label: const Text("Gallery")),

                  TextButton.icon(onPressed: () => _pickImage(ImageSource.camera), icon: const Icon(Icons.camera_alt), label: const Text("Camera")),
                ],
              ),

              const SizedBox(height: 16),

              // Actions
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(onPressed: _loading ? null : () => Navigator.pop(context), child: const Text("Cancel")),

                  const SizedBox(width: 8),

                  Button(type: .elevated, color: .secondary, onPressed: isButtonDisabled() ? null : _upload, isLoading: _loading, label: "Upload"),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
