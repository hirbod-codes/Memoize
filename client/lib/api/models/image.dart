import 'dart:convert';

class ImageInfo {
  String id;
  String title;
  String fileName;
  String contentType;
  int? createdAt;
  int? updatedAt;

  ImageInfo({required this.id, required this.contentType, required this.title, required this.fileName, this.createdAt, this.updatedAt});

  Map<String, dynamic> toJson() => ({'id': id, 'contentType': contentType, 'title': title, 'fileName': fileName, 'createdAt': createdAt, 'updatedAt': updatedAt});

  @override
  String toString() => jsonEncode(toJson());

  factory ImageInfo.fromJson(Map<String, dynamic> json) {
    final id = json['_id'];
    final fileName = json['fileName'];
    final title = json['title'];
    final contentType = json['contentType'];
    final createdAt = (json['metadata']?['createdAt'] as num?)?.toInt();
    final updatedAt = (json['metadata']?['updatedAt'] as num?)?.toInt();

    return ImageInfo(id: id, contentType: contentType, title: title, fileName: fileName, createdAt: createdAt, updatedAt: updatedAt);
  }
}
