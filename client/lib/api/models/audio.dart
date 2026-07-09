import 'dart:convert';

class Audio {
  String id;
  String userId;
  String contentType;
  String title;
  String fileName;
  String coverArtFileName;
  String bucketKey;
  String coverArtKey;
  int createdAt;
  int updatedAt;

  Audio({required this.id, required this.contentType, required this.title, required this.createdAt, required this.updatedAt, required this.userId, required this.fileName, required this.coverArtFileName, required this.bucketKey, required this.coverArtKey});

  factory Audio.fromJson(Map<String, dynamic> json) {
    final id = json['_id'];
    final contentType = json['contentType'];
    final title = json['title'];
    final userId = json['userId'];
    final fileName = json['fileName'];
    final coverArtFileName = json['coverArtFileName'];
    final bucketKey = json['bucketKey'];
    final coverArtKey = json['coverArtKey'];
    final createdAt = (json['createdAt'] as num).toInt();
    final updatedAt = (json['updatedAt'] as num).toInt();

    return Audio(id: id, contentType: contentType, title: title, createdAt: createdAt, updatedAt: updatedAt, userId: userId, fileName: fileName, coverArtFileName: coverArtFileName, bucketKey: bucketKey, coverArtKey: coverArtKey);
  }

  Map<String, dynamic> toJson() => ({'id': id, 'contentType': contentType, 'title': title, 'createdAt': createdAt, 'updatedAt': updatedAt, 'userId': userId, 'fileName': fileName, 'coverArtFileName': coverArtFileName, 'bucketKey': bucketKey, 'coverArtKey': coverArtKey});

  @override
  String toString() => jsonEncode(toJson());
}
