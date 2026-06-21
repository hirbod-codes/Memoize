import 'dart:convert';

class Folder {
  late String id;
  late String title;
  late String userId;
  late String? parentId;
  late List<String> treeNodeIds;
  late List<String> leafIds;
  late int createdAt;
  late int updatedAt;

  Folder({required this.id, required this.title, required this.userId, this.parentId, required this.treeNodeIds, required this.leafIds, required this.createdAt, required this.updatedAt});

  Map<String, dynamic> toJson() => ({'id': id, 'title': title, 'createdAt': createdAt, 'updatedAt': updatedAt});

  @override
  String toString() => jsonEncode(toJson());

  factory Folder.fromJson(Map<String, dynamic> json) {
    final id = json['_id'];
    final userId = json['userId'];
    final title = json['title'];
    final parentId = json['parentId'];
    final treeNodeIds = (json['treeNodeIds'] as List<dynamic>).cast<String>();
    final leafIds = (json['leafIds'] as List<dynamic>).cast<String>();
    final createdAt = (json['createdAt'] as num).toInt();
    final updatedAt = (json['updatedAt'] as num).toInt();

    return Folder(id: id, title: title, userId: userId, parentId: parentId, treeNodeIds: treeNodeIds, leafIds: leafIds, createdAt: createdAt, updatedAt: updatedAt);
  }

  Folder copyWith({String? id, String? title, String? userId, List<String>? treeNodeIds, List<String>? leafIds, int? createdAt, int? updatedAt}) {
    return Folder(id: id ?? this.id, title: title ?? this.title, userId: userId ?? this.userId, treeNodeIds: treeNodeIds ?? [...this.treeNodeIds], leafIds: leafIds ?? [...this.leafIds], createdAt: createdAt ?? this.createdAt, updatedAt: updatedAt ?? this.updatedAt);
  }
}
