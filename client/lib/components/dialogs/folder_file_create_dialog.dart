import 'package:client/components/button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class FolderFileCreateDialog extends ConsumerStatefulWidget {
  const FolderFileCreateDialog({super.key});

  @override
  ConsumerState<FolderFileCreateDialog> createState() => _FolderFileCreateDialogState();
}

class _FolderFileCreateDialogState extends ConsumerState<FolderFileCreateDialog> {
  final titleController = TextEditingController();

  @override
  void dispose() {
    titleController.dispose();
    super.dispose();
  }

  bool isButtonDisabled() => titleController.text.trim().isEmpty;

  Future<void> _upload() async {
    if (isButtonDisabled()) return;

    Navigator.pop(context, titleController.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.all(20),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleController,
                decoration: const InputDecoration(labelText: 'Title'),
              ),

              const SizedBox(height: 16),

              // Actions
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),

                  const SizedBox(width: 8),

                  Button(type: .elevated, color: .secondary, onPressed: isButtonDisabled() ? null : _upload, label: "Upload"),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
