import 'dart:convert';

import 'package:client/api/api_call.dart';
import 'package:client/api/models/video.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:client/lib/talker.dart';

class VideoController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  VideoController(this.ref);

  Future<Response> post({required String title, required XFile file, ProgressCallback? onSendProgress}) async {
    talker.info('VideoController.post is called...');

    final form = FormData.fromMap({'file': MultipartFile.fromStream(() => file.openRead(), await file.length(), filename: file.name)});
    final response = await _authDio.post('/api/video/', data: form, queryParameters: {'title': title, 'fileName': file.name}, onSendProgress: onSendProgress);

    talker.info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    talker.info('VideoController.post call ended');
    return response;
  }

  Future<Video?> get({required String videoId}) async {
    talker.info('VideoController.get is called...');

    final response = await apiCall(() => _authDio.get('/api/video/info?id=$videoId'));
    talker.info({'response.dataOrNull': response.dataOrNull});
    if (response.isFailure || response.dataOrNull == null) {
      talker.info('Null response data!');
      talker.info('VideoController.get call ended');
      return null;
    }

    talker.info('VideoController.get call ended');
    return Video.fromJson(response.dataOrNull);
  }

  Future<String?> getSignedToken({required String videoId}) async {
    talker.info('VideoController.get is called...');

    // final response = await _authDio.get('/api/video/singed_token?videoId=$videoId');
    // talker.info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    final response = await apiCall(() => _authDio.get('/api/video/singed_token?videoId=$videoId'));
    talker.info({'response.dataOrNull': response.dataOrNull});
    if (response.isFailure || response.dataOrNull == null) {
      talker.info('Null response data!');
      talker.info('VideoController.get call ended');
      return null;
    }

    talker.info('VideoController.get call ended');
    return response.dataOrNull;
  }
}

final videoControllerProvider = Provider((ref) => VideoController(ref));
