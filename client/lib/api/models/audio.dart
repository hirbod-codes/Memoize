import 'dart:convert';

class Audio {
  String id;
  String userId;
  String title;
  String coverArtFileName;
  String? bucketKey;
  String? webBucketKey;
  String? coverArtKey;
  int createdAt;
  int updatedAt;

  Audio({
    required this.id,
    required this.userId,
    required this.title,
    required this.coverArtFileName,
    this.bucketKey,
    this.webBucketKey,
    this.coverArtKey,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Audio.fromJson(Map<String, dynamic> json) {
    final id = json['_id'];
    final title = json['title'];
    final userId = json['userId'];
    final coverArtFileName = json['coverArtFileName'];
    final bucketKey = json['bucketKey'];
    final webBucketKey = json['webBucketKey'];
    final coverArtKey = json['coverArtKey'];
    final createdAt = (json['createdAt'] as num).toInt();
    final updatedAt = (json['updatedAt'] as num).toInt();

    return Audio(
      id: id,
      title: title,
      createdAt: createdAt,
      updatedAt: updatedAt,
      userId: userId,
      coverArtFileName: coverArtFileName,
      bucketKey: bucketKey,
      webBucketKey: webBucketKey,
      coverArtKey: coverArtKey,
    );
  }

  Map<String, dynamic> toJson() => ({
    'id': id,
    'title': title,
    'createdAt': createdAt,
    'updatedAt': updatedAt,
    'userId': userId,
    'coverArtFileName': coverArtFileName,
    'bucketKey': bucketKey,
    'webBucketKey': webBucketKey,
    'coverArtKey': coverArtKey,
  });

  @override
  String toString() => jsonEncode(toJson());
}
