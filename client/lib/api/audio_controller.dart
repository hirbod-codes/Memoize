import 'dart:io';

import 'package:client/api/models/audio.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AudioController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  AudioController(this.ref);

  Future<Response> post({required String title, required File file, String? fileName, ProgressCallback? onSendProgress}) async {
    return await _authDio.post(
      '/api/video/?title=$title&fileName=${fileName ?? file.path.split('/').last}',
      data: FormData.fromMap({'file': await MultipartFile.fromFile(file.path, filename: file.path.split('/').last)}),
      onSendProgress: onSendProgress,
    );
  }

  Future<Audio?> get({required String audioId}) async {
    final response = await _authDio.get('/api/audio/info?audioId=$audioId');
    if (response.data == null) return null;

    return Audio.fromJson(response.data);
  }

  Future<Audio?> getByTitle({required String title}) async {
    final response = await _authDio.get('/api/audio/info?title=$title');
    if (response.data == null) return null;

    return Audio.fromJson(response.data);
  }
}

final audioControllerProvider = Provider((ref) => AudioController(ref));
