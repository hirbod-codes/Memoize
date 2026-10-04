import 'dart:convert';

import 'package:client/api/api_call.dart';
import 'package:client/api/models/audio.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:client/lib/talker.dart';

class AudioController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  AudioController(this.ref);

  Future<Response> post({required String title, required XFile file, ProgressCallback? onSendProgress}) async {
    talker.info('AudioController.post is called...');

    final form = FormData.fromMap({'file': MultipartFile.fromStream(() => file.openRead(), await file.length(), filename: file.name)});
    final response = await _authDio.post('/api/audio/', data: form, queryParameters: {'title': title, 'fileName': file.name}, onSendProgress: onSendProgress);

    talker.info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    talker.info('AudioController.post call ended');
    return response;
  }

  Future<Audio?> get({required String audioId}) async {
    talker.info('AudioController.get is called...');

    final response = await apiCall(() => _authDio.get('/api/audio/info?audioId=$audioId'));
    talker.info({'response.dataOrNull': response.dataOrNull});
    if (response.isFailure || response.dataOrNull == null) {
      talker.info('Null response data!');
      talker.info('AudioController.get call ended');
      return null;
    }

    return Audio.fromJson(response.dataOrNull);
  }

  Future<String?> getSignedToken({required String audioId}) async {
    talker.info('AudioController.get is called...');

    final response = await apiCall(() => _authDio.get('/api/audio/singed_token?audioId=$audioId'));
    talker.info({'response.dataOrNull': response.dataOrNull});
    if (response.isFailure || response.dataOrNull == null) {
      talker.info('Null response data!');
      talker.info('AudioController.get call ended');
      return null;
    }

    return response.dataOrNull;
  }

  Future<Audio?> getByTitle({required String title}) async {
    talker.info('AudioController.getByTitle is called...');

    final response = await apiCall(() => _authDio.get('/api/audio/info?title=$title'));
    talker.info({'response.dataOrNull': response.dataOrNull});
    if (response.isFailure || response.dataOrNull == null) {
      talker.info('Null response data!');
      talker.info('AudioController.getByTitle call ended');
      return null;
    }

    return Audio.fromJson(response.dataOrNull);
  }
}

final audioControllerProvider = Provider((ref) => AudioController(ref));
