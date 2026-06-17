import 'package:client/api/models/audio.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AudioController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  AudioController(this.ref);

  // Future<String> create({required String title, required String treeNodeId, required List<Content> termContents, required List<Content> definitionContents}) async {
  //   final response = await _authDio.post('/api/leaf/', data: {'title': title, 'treeNodeId': treeNodeId, 'termContents': termContents, 'definitionContents': definitionContents});

  //   return response.data['id'];
  // }

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

  // Future<Response> patch({required String id, String? title, List<Content>? termContents, List<Content>? definitionContents}) async {
  //   final Map<String, dynamic> data = {'_id': id};
  //   if (title != null) data['title'] = title;
  //   if (termContents != null) data['termContents'] = termContents;
  //   if (definitionContents != null) data['definitionContents'] = definitionContents;

  //   return await _authDio.patch('/api/leaf/', data: data);
  // }

  // Future<Response> delete({required String id}) async {
  //   return await _authDio.delete('/api/leaf/?id=$id');
  // }
}

final audioControllerProvider = Provider((ref) => AudioController(ref));
