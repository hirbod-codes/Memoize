class Folder {
  late final String id;
  late final String title;
  late final String userId;
  late final String? parentId;
  late final List<String> treeNodeIds;
  late final List<String> leafIds;
  late final int createdAt;
  late final int updatedAt;

  Folder({required this.id, required this.title, required this.userId, this.parentId, required this.treeNodeIds, required this.leafIds, required this.createdAt, required this.updatedAt});

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
}
