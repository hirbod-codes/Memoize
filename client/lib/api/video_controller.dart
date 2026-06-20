import 'dart:convert';
import 'dart:io';

import 'package:client/api/models/video.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

class VideoController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  VideoController(this.ref);

  Future<Response> post({required String title, required File file, String? fileName, ProgressCallback? onSendProgress}) async {
    Talker().info('VideoController.post is called...');

    final response = await _authDio.post(
      '/api/video/?title=$title&fileName=${fileName ?? file.path.split('/').last}',
      data: FormData.fromMap({'file': await MultipartFile.fromFile(file.path, filename: file.path.split('/').last)}),
      onSendProgress: onSendProgress,
    );
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    Talker().info('VideoController.post call ended');
    return response;
  }

  Future<Video?> get({required String videoId}) async {
    Talker().info('VideoController.get is called...');

    final response = await _authDio.get('/api/video/info?id=$videoId');
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');
    if (response.data == null) {
      Talker().info('Null response data!');
      Talker().info('VideoController.get call ended');
      return null;
    }

    Talker().info('VideoController.get call ended');
    return Video.fromJson(response.data);
  }
}

final videoControllerProvider = Provider((ref) => VideoController(ref));
