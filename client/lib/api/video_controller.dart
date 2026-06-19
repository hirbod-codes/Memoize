import 'dart:io';

import 'package:client/api/models/video.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class VideoController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  VideoController(this.ref);

  Future<Response> post({required String title, required File file, String? fileName, ProgressCallback? onSendProgress}) async {
    return await _authDio.post(
      '/api/video/?title=$title&fileName=${fileName ?? file.path.split('/').last}',
      data: FormData.fromMap({'file': await MultipartFile.fromFile(file.path, filename: file.path.split('/').last)}),
      onSendProgress: onSendProgress,
    );
  }

  Future<Video?> get({required String videoId}) async {
    final response = await _authDio.get('/api/video/info?id=$videoId');
    if (response.data == null) return null;

    return Video.fromJson(response.data);
  }
}

final videoControllerProvider = Provider((ref) => VideoController(ref));
