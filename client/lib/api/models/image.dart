import 'dart:convert';

class ImageInfo {
  final String id;
  final String title;
  final String fileName;
  final String contentType;
  final int? createdAt;
  final int? updatedAt;

  ImageInfo({required this.id, required this.contentType, required this.title, required this.fileName, this.createdAt, this.updatedAt});

  Map<String, dynamic> toJson() => ({'id': id, 'contentType': contentType, 'title': title, 'fileName': fileName, 'createdAt': createdAt, 'updatedAt': updatedAt});

  @override
  String toString() => jsonEncode(toJson());

  factory ImageInfo.fromJson(Map<String, dynamic> json) {
    final id = json['_id'];
    final fileName = json['filename'];
    final title = json['metadata']?['title'];
    final contentType = json['metadata']?['contentType'];
    final createdAt = (json['metadata']?['createdAt'] as num?)?.toInt();
    final updatedAt = (json['metadata']?['updatedAt'] as num?)?.toInt();

    return ImageInfo(id: id, contentType: contentType, title: title, fileName: fileName, createdAt: createdAt, updatedAt: updatedAt);
  }
}
