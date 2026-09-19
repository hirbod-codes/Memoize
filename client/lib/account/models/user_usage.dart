class ValuePerContentCount {
  final int? string;
  final int? richText;
  final int? image;
  final int? audio;
  final int? video;

  ValuePerContentCount({required this.string, required this.richText, required this.image, required this.audio, required this.video});

  factory ValuePerContentCount.fromJson(Map<String, dynamic> json) => ValuePerContentCount(
    string: json['string'] as int?,
    richText: json['richText'] as int?,
    image: json['image'] as int?,
    audio: json['audio'] as int?,
    video: json['video'] as int?,
  );

  Map<String, dynamic> toJson() => {'string': string, 'richText': richText, 'image': image, 'audio': audio, 'video': video};
}

class UserUsage {
  final String _id;
  final String userId;
  final int categoriesCount;
  final int nestedCategoriesCount;
  final int cardsPerCategoryCount;
  final int contentsPerCardSideCount;
  final int storageBytesCount;
  final ValuePerContentCount valuePerContentCount;

  const UserUsage({
    required String id,
    required this.userId,
    required this.categoriesCount,
    required this.nestedCategoriesCount,
    required this.cardsPerCategoryCount,
    required this.contentsPerCardSideCount,
    required this.storageBytesCount,
    required this.valuePerContentCount,
  }) : _id = id;

  factory UserUsage.fromJson(Map<String, dynamic> json) => UserUsage(
    id: json['_id'] as String,
    userId: json['userId'] as String,
    categoriesCount: json['categoriesCount'] as int,
    nestedCategoriesCount: json['nestedCategoriesCount'] as int,
    cardsPerCategoryCount: json['cardsPerCategoryCount'] as int,
    contentsPerCardSideCount: json['contentsPerCardSideCount'] as int,
    storageBytesCount: json['storageBytesCount'] as int,
    valuePerContentCount: ValuePerContentCount.fromJson(json['valuePerContentCount'] as Map<String, dynamic>),
  );

  Map<String, dynamic> toJson() => {
    '_id': _id,
    'userId': userId,
    'categoriesCount': categoriesCount,
    'nestedCategoriesCount': nestedCategoriesCount,
    'cardsPerCategoryCount': cardsPerCategoryCount,
    'contentsPerCardSideCount': contentsPerCardSideCount,
    'storageBytesCount': storageBytesCount,
    'valuePerContentCount': valuePerContentCount.toJson(),
  };
}
