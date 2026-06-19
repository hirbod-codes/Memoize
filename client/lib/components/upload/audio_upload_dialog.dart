import 'dart:io';

import 'package:client/api/audio_controller.dart';
import 'package:client/components/button.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart';
import 'package:file_picker/file_picker.dart';

class AudioUploadDialog extends ConsumerStatefulWidget {
  const AudioUploadDialog({super.key});

  @override
  ConsumerState<AudioUploadDialog> createState() => _AudioUploadDialogState();
}

class _AudioUploadDialogState extends ConsumerState<AudioUploadDialog> {
  final titleController = TextEditingController();
  Player? _player;
  File? _audioFile;
  String? _fileName;

  bool _loading = false;
  bool _playing = false;

  @override
  void dispose() {
    titleController.dispose();
    _player?.dispose();
    super.dispose();
  }

  Future<void> _pickAudio() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.audio, allowMultiple: false);

    if (result == null) return;

    final path = result.files.single.path;
    if (path == null) return;

    final file = File(path);

    await _player?.dispose();

    final player = Player();

    await player.open(Media(path), play: false);

    player.stream.playing.listen((playing) {
      if (mounted) {
        setState(() {
          _playing = playing;
        });
      }
    });

    setState(() {
      _audioFile = file;
      _fileName = result.files.single.name;
      _player = player;
    });
  }

  Future<void> _togglePlay() async {
    if (_player == null) return;

    if (_playing) {
      await _player!.pause();
    } else {
      await _player!.play();
    }
  }

  bool isButtonDisabled() => _audioFile == null || titleController.text.trim().isEmpty;

  Future<void> _upload() async {
    if (isButtonDisabled()) return;

    setState(() => _loading = true);

    try {
      Response<dynamic> res = await ref.read(audioControllerProvider).post(title: titleController.text.trim(), file: _audioFile!);
      if (res.statusCode == null || res.statusCode! < 200 || res.statusCode! > 299) return;
      if (!mounted) return;

      Navigator.pop(context, res.data['id']);
    } finally {
      if (mounted) setState(() => _loading = false);
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
              const Text('Upload Audio', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),

              const SizedBox(height: 20),

              TextField(
                controller: titleController,
                decoration: const InputDecoration(labelText: 'Title'),
              ),

              const SizedBox(height: 20),

              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: _audioFile == null
                    ? const Center(child: Text('No audio selected'))
                    : Column(
                        children: [
                          const Icon(Icons.audio_file, size: 48),

                          const SizedBox(height: 12),

                          Text(_fileName ?? '', textAlign: TextAlign.center, overflow: TextOverflow.ellipsis),

                          const SizedBox(height: 12),

                          IconButton(onPressed: _togglePlay, icon: Icon(_playing ? Icons.pause : Icons.play_arrow)),
                        ],
                      ),
              ),

              const SizedBox(height: 16),

              TextButton.icon(onPressed: _pickAudio, icon: const Icon(Icons.library_music), label: const Text('Choose Audio')),

              const SizedBox(height: 16),

              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(onPressed: _loading ? null : () => Navigator.pop(context), child: const Text('Cancel')),

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
