import 'package:client/plan/models/content_type_flags.dart';
import 'package:client/plan/models/max_value_per_content.dart';

/// Mirrors `privilegesSchema`.
class Privileges {
  final int maxCategories;
  final int maxNestedCategories;
  final int maxCardsPerCategory;
  final int maxContentsPerCardSide;
  final int maxStorageBytes;
  final ContentTypeFlags allowedContentTypes;

  /// Per-content-type size caps (`maxValuePerContent`). Parsed but
  /// deliberately not surfaced as a marketing bullet on the pricing
  /// page — it's an internal limit, not something a prospective user
  /// is comparing plans on. Kept here in case a future "full spec"
  /// comparison view wants it.
  final MaxValuePerContent maxValuePerContent;

  const Privileges({
    required this.maxCategories,
    required this.maxNestedCategories,
    required this.maxCardsPerCategory,
    required this.maxContentsPerCardSide,
    required this.maxStorageBytes,
    required this.allowedContentTypes,
    required this.maxValuePerContent,
  });

  factory Privileges.fromJson(Map<String, dynamic> json) => Privileges(
    maxCategories: json['maxCategories'] as int,
    maxNestedCategories: json['maxNestedCategories'] as int,
    maxCardsPerCategory: json['maxCardsPerCategory'] as int,
    maxContentsPerCardSide: json['maxContentsPerCardSide'] as int,
    maxStorageBytes: json['maxStorageBytes'] as int,
    allowedContentTypes: ContentTypeFlags.fromJson(json['allowedContentTypes'] as Map<String, dynamic>),
    maxValuePerContent: MaxValuePerContent.fromJson(json['maxValuePerContent'] as Map<String, dynamic>),
  );

  Map<String, dynamic> toJson() => {
    'maxCategories': maxCategories,
    'maxNestedCategories': maxNestedCategories,
    'maxCardsPerCategory': maxCardsPerCategory,
    'maxContentsPerCardSide': maxContentsPerCardSide,
    'maxStorageBytes': maxStorageBytes,
    'allowedContentTypes': allowedContentTypes.toJson(),
    'maxValuePerContent': maxValuePerContent.toJson(),
  };
}
