import 'package:client/account/models/user_info.dart';
import 'package:client/account/user_info_notifier.dart';
import 'package:client/plan/models/plan.dart';
import 'package:client/plan/all_plans_notifier.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

extension PlanCapabilities on UserInfo {
  Plan? _getPlan(WidgetRef ref) {
    final info = ref.watch(userInfoProvider).info;
    if (info == null) return null;

    final plans = ref.watch(allPlansProvider).plans;
    if (plans == null) return null;

    final plan = plans.firstWhere((e) => e.title == info.planTitle);
    return plan;
  }

  bool isStringContentAllowed(WidgetRef ref) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return plan.privileges.allowedContentTypes.string;
  }

  bool isStringContentForbidden(WidgetRef ref) => !isStringContentAllowed(ref);

  bool isRichTextContentAllowed(WidgetRef ref) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return plan.privileges.allowedContentTypes.richText;
  }

  bool isRichTextContentForbidden(WidgetRef ref) => !isRichTextContentAllowed(ref);

  bool isImageContentAllowed(WidgetRef ref) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return plan.privileges.allowedContentTypes.image;
  }

  bool isImageContentForbidden(WidgetRef ref) => !isImageContentAllowed(ref);

  bool isAudioContentAllowed(WidgetRef ref) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return plan.privileges.allowedContentTypes.audio;
  }

  bool isAudioContentForbidden(WidgetRef ref) => !isAudioContentAllowed(ref);

  bool isVideoContentAllowed(WidgetRef ref) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return plan.privileges.allowedContentTypes.video;
  }

  bool isVideoContentForbidden(WidgetRef ref) => !isVideoContentAllowed(ref);

  bool maxCardsPerCategoryReached(WidgetRef ref, int currentCount) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return currentCount >= plan.privileges.maxCardsPerCategory;
  }

  bool maxCategoriesReached(WidgetRef ref, int currentCount) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return currentCount >= plan.privileges.maxCategories;
  }

  bool maxContentsPerCardSide(WidgetRef ref, int currentCount) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return currentCount >= plan.privileges.maxContentsPerCardSide;
  }

  bool maxNestedCategoriesReached(WidgetRef ref, int currentCount) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return currentCount >= plan.privileges.maxNestedCategories;
  }

  bool maxStorageBytesReached(WidgetRef ref, int currentCount) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return currentCount >= plan.privileges.maxStorageBytes;
  }

  bool maxValuePerContentStringReached(WidgetRef ref, int currentCount) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return currentCount >= plan.privileges.maxValuePerContent.string;
  }

  bool maxValuePerContentRichTextReached(WidgetRef ref, int currentCount) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return currentCount >= plan.privileges.maxValuePerContent.richText;
  }

  bool maxValuePerContentImageReached(WidgetRef ref, int currentCount) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return currentCount >= plan.privileges.maxValuePerContent.image;
  }

  bool maxValuePerContentAudioReached(WidgetRef ref, int currentCount) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return currentCount >= plan.privileges.maxValuePerContent.audio;
  }

  bool maxValuePerContentVideoReached(WidgetRef ref, int currentCount) {
    final plan = _getPlan(ref);
    if (plan == null) return false;

    return currentCount >= plan.privileges.maxValuePerContent.video;
  }
}
