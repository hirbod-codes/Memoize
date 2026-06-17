class Audio {
  final String id;
  final String contentType;
  final String title;
  final dynamic file;
  final dynamic musical;
  final dynamic metadata;
  final int createdAt;
  final int updatedAt;

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
}
