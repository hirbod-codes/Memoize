import 'package:client/api/models/leaf.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class LeafController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  LeafController(this.ref);

  Future<String> create({required String title, required String treeNodeId, required List<Content> termContents, required List<Content> definitionContents}) async {
    final response = await _authDio.post('/api/leaf/', data: {'title': title, 'treeNodeId': treeNodeId, 'termContents': termContents, 'definitionContents': definitionContents});

    return response.data['id'];
  }

  Future<List<Leaf>> getMany({required List<String> leafIds}) async {
    final response = await _authDio.get('/api/leaf/?leafIds=${leafIds.join(',')}');

    final List<dynamic> leafs = response.data;

    return leafs.map((f) => Leaf.fromJson(f)).toList();
  }

  Future<List<Leaf>> getChildren({required String parentTreeNodeId}) async {
    final response = await _authDio.get('/api/leaf/?parentTreeNodeId=$parentTreeNodeId');

    final List<dynamic> leafs = response.data;

    return leafs.map((f) => Leaf.fromJson(f)).toList();
  }

  Future<List<Leaf>> getPaginated({required int limit, required String parentId, String? search, int? skip}) async {
    final response = await _authDio.get('/api/leaf/list/?limit=$limit&parentId=$parentId${skip != null ? '&skip=$skip' : ''}${search != null ? '&search=$search' : ''}');

    final List<dynamic> leafs = response.data;

    return leafs.map((f) => Leaf.fromJson(f)).toList();
  }

  Future<Response> patch({required String id, String? title, List<Content>? termContents, List<Content>? definitionContents}) async {
    final Map<String, dynamic> data = {'_id': id};
    if (title != null) data['title'] = title;
    if (termContents != null) data['termContents'] = termContents;
    if (definitionContents != null) data['definitionContents'] = definitionContents;

    return await _authDio.patch('/api/leaf/', data: data);
  }

  Future<Response> delete({required String id}) async {
    return await _authDio.delete('/api/leaf/?id=$id');
  }
}

final leafControllerProvider = Provider((ref) => LeafController(ref));
