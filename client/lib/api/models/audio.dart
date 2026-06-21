import 'dart:convert';

class Audio {
  String id;
  String contentType;
  String title;
  dynamic file;
  dynamic musical;
  dynamic metadata;
  int createdAt;
  int updatedAt;

  Audio({required this.id, required this.contentType, required this.title, required this.file, required this.musical, required this.metadata, required this.createdAt, required this.updatedAt});

  factory Audio.fromJson(Map<String, dynamic> json) {
    final id = json['_id'];
    final contentType = json['contentType'];
    final title = json['title'];
    final file = json['file'];
    final musical = json['musical'];
    final metadata = json['metadata'];
    final createdAt = (json['createdAt'] as num).toInt();
    final updatedAt = (json['updatedAt'] as num).toInt();

    return Audio(id: id, contentType: contentType, title: title, file: file, musical: musical, metadata: metadata, createdAt: createdAt, updatedAt: updatedAt);
  }

  Map<String, dynamic> toJson() => ({'id': id, 'contentType': contentType, 'title': title, 'file': file, 'musical': musical, 'metadata': metadata, 'createdAt': createdAt, 'updatedAt': updatedAt});

  @override
  String toString() => jsonEncode(toJson());
}
