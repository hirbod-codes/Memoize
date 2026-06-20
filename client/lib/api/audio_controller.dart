import 'dart:convert';
import 'dart:io';

import 'package:client/api/models/audio.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

class AudioController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  AudioController(this.ref);

  Future<Response> post({required String title, required File file, String? fileName, ProgressCallback? onSendProgress}) async {
    Talker().info('AudioController.post is called...');

    final response = await _authDio.post(
      '/api/video/?title=$title&fileName=${fileName ?? file.path.split('/').last}',
      data: FormData.fromMap({'file': await MultipartFile.fromFile(file.path, filename: file.path.split('/').last)}),
      onSendProgress: onSendProgress,
    );
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    Talker().info('AudioController.post call ended');
    return response;
  }

  Future<Audio?> get({required String audioId}) async {
    Talker().info('AudioController.get is called...');

    final response = await _authDio.get('/api/audio/info?audioId=$audioId');
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');
    if (response.data == null) {
      Talker().info('Null response data!');
      Talker().info('AudioController.get call ended');
      return null;
    }

    Talker().info('AudioController.get call ended');
    return Audio.fromJson(response.data);
  }

  Future<Audio?> getByTitle({required String title}) async {
    Talker().info('AudioController.getByTitle is called...');

    final response = await _authDio.get('/api/audio/info?title=$title');
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');
    if (response.data == null) {
      Talker().info('Null response data!');
      Talker().info('AudioController.getByTitle call ended');
      return null;
    }

    Talker().info('AudioController.getByTitle call ended');
    return Audio.fromJson(response.data);
  }
}

final audioControllerProvider = Provider((ref) => AudioController(ref));
