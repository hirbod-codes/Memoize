class LeafPost {
  final String id;

  LeafPost({required this.id});
}

enum ContentType { string, richText, imageId, videoId, audioId }

class Content {
  final ContentType type;
  final List<String> value;

  Content({required this.type, required this.value});

  static ContentType _parseContentType(String value) {
    switch (value) {
      case 'string':
        return ContentType.string;
      case 'richText':
        return ContentType.richText;
      case 'imageId':
        return ContentType.imageId;
      case 'videoId':
        return ContentType.videoId;
      case 'audioId':
        return ContentType.audioId;
      default:
        throw ArgumentError('Unknown ContentType: $value');
    }
  }

  factory Content.fromJson(Map<String, dynamic> json) {
    final type = _parseContentType(json['type'] as String);
    final value = (json['value'] as List<dynamic>).cast<String>();

    return Content(type: type, value: value);
  }
}

class Leaf {
  late final String id;
  late final String userId;
  late final String treeNodeId;
  late final String title;
  late final List<Content> termContents;
  late final List<Content> definitionContents;
  late final int createdAt;
  late final int updatedAt;

  Leaf({required this.id, required this.userId, required this.treeNodeId, required this.title, required this.termContents, required this.definitionContents, required this.createdAt, required this.updatedAt});

  factory Leaf.fromJson(Map<String, dynamic> json) {
    final id = json['_id'];
    final userId = json['userId'];
    final treeNodeId = json['treeNodeId'];
    final title = json['title'];
    final termContents = (json['termContents'] as List<dynamic>?)?.map((e) => Content.fromJson(e as Map<String, dynamic>)).toList() ?? [];
    final definitionContents = (json['definitionContents'] as List<dynamic>?)?.map((e) => Content.fromJson(e as Map<String, dynamic>)).toList() ?? [];
    final createdAt = (json['createdAt'] as num).toInt();
    final updatedAt = (json['updatedAt'] as num).toInt();

    return Leaf(id: id, userId: userId, treeNodeId: treeNodeId, title: title, termContents: termContents, definitionContents: definitionContents, createdAt: createdAt, updatedAt: updatedAt);
  }
}
