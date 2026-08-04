import 'dart:convert';

import 'package:talker/talker.dart';
import 'package:client/api/models/leaf.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class LeafController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  LeafController(this.ref);

  Future<String> create({required String title, required String treeNodeId, required List<Content> termContents, required List<Content> definitionContents}) async {
    Talker().info('LeafController.create is called...');

    var data = {'title': title, 'treeNodeId': treeNodeId, 'termContents': termContents.map((c) => c.toJson()).toList(), 'definitionContents': definitionContents.map((c) => c.toJson()).toList()};
    Talker().info('input data: ${jsonEncode(data)}');

    final response = await _authDio.post('/api/leaf/', data: {'leaf': data});
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    Talker().info('LeafController.create call ended');
    return response.data['id'];
  }

  Future<List<Leaf>> getMany({required List<String> leafIds}) async {
    Talker().info('LeafController.getMany is called...');

    final response = await _authDio.get('/api/leaf/?leafIds=${leafIds.join(',')}');
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    final List<dynamic> leafs = response.data;

    Talker().info('LeafController.getMany call ended');
    return leafs.map((f) => Leaf.fromJson(f)).toList();
  }

  Future<List<Leaf>> getChildren({required String parentTreeNodeId}) async {
    Talker().info('LeafController.getChildren is called...');

    final response = await _authDio.get('/api/leaf/?parentTreeNodeId=$parentTreeNodeId');
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    final List<dynamic> leafs = response.data;

    Talker().info('LeafController.getChildren call ended');
    return leafs.map((f) => Leaf.fromJson(f)).toList();
  }

  Future<List<Leaf>> getPaginated({required int limit, required String parentId, String? search, int? skip}) async {
    Talker().info('LeafController.getPaginated is called...');

    final response = await _authDio.get('/api/leaf/list/?limit=$limit&parentId=$parentId${skip != null ? '&skip=$skip' : ''}${search != null ? '&search=$search' : ''}');
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    final List<dynamic> leafs = response.data;

    Talker().info('LeafController.getPaginated call ended');
    return leafs.map((f) => Leaf.fromJson(f)).toList();
  }

  Future<Response> patch({required String id, String? title, String? parentTreeNodeId, List<Content>? termContents, List<Content>? definitionContents}) async {
    Talker().info('LeafController.patch is called...');

    final Map<String, dynamic> data = {'_id': id};
    if (title != null) data['title'] = title;
    if (parentTreeNodeId != null) data['parentTreeNodeId'] = parentTreeNodeId;
    if (termContents != null) data['termContents'] = termContents.map((c) => c.toJson()).toList();
    if (definitionContents != null) data['definitionContents'] = definitionContents.map((c) => c.toJson()).toList();

    Talker().info('input data: ${jsonEncode(data)}');

    final response = await _authDio.patch('/api/leaf/', data: {'leaf': data});
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    Talker().info('LeafController.patch call ended');
    return response;
  }

  Future<Response> delete({required String id}) async {
    Talker().info('LeafController.delete is called...');

    final response = await _authDio.delete('/api/leaf/?id=$id');
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    Talker().info('LeafController.delete call ended');
    return response;
  }
}

final leafControllerProvider = Provider((ref) => LeafController(ref));
