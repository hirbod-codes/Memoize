import 'package:client/auth/models/auth_models.dart';
import 'package:client/localization/calendars/calendar_system.dart';

// const statusSchema = string().oneOf(['active', 'canceled', 'trial', 'paymentNotVerified', 'paymentNotCompleted', 'inDebtToUser'])
// const processorSubscriptionIdSchema = string().when('status', { is: 'paymentNotVerified', then(s) { return s.optional() }, otherwise(s) { return s.required() } })

// export type PaymentMethod = "zarinpal" | "paypal" | "bitcoin" | "zibal"
// export type SubscriptionDuration = "month" | "year"

// export const paymentMethodSchema = string().oneOf<PaymentMethod>(['zarinpal', 'zibal', 'paypal', 'bitcoin'])
// export const subscriptionDurationSchema = string().oneOf<SubscriptionDuration>(['month', 'year'])

// export const subscriptionSchema = object().shape({
//     schemaVersion: string().optional().min(6).max(20),
//     _id: likeObjectId.optional(),

//     userId: string().required(),

//     planTitle: string().required().label('Plan title'),

//     privileges: privilegesSchema.required(),

//     status: statusSchema.required(),

//     duration: subscriptionDurationSchema.required(),

//     currentPeriodEnd: number().required(),

//     processorSubscriptionId: processorSubscriptionIdSchema,

//     price: priceSchema.required(),

//     paymentMethod: paymentMethodSchema.required(),

//     paymentAuthority: string().optional(),

//     completedAt: number().integer().min(0).optional(),

//     verifiedAt: number().integer().min(0).optional(),

//     refId: string().optional(),
//     cardNumber: string().optional(),
//     cardNumberHash: string().optional(),

//     createdAt: number().optional(),
//     updatedAt: number().optional(),
// })

/// Mirrors /api/auth/info's response shape. Deliberately has no
/// `password` field — even though the backend's validation schema
/// includes one (shared with write/insert validation), an info
/// endpoint should never actually send a password or hash back to the
/// client.
///
/// locale/calendarType/timeZone are NOT in the schema you gave me —
/// added here as optional fields on the assumption the backend will
/// store per-account localization preferences that should follow the
/// user across devices. If that assumption is wrong, these just stay
/// null forever and nothing breaks; if it's right, the backend needs
/// matching fields added to planSchema^H^H^H^H the user document schema.
class UserInfo {
  final String? id;
  final String role;
  final String planTitle;
  final AuthMethod authMethod;
  final String? username;
  final String? phoneNumber;
  final String? email;
  final String? avatarKey;
  final bool temporaryAvatar;
  final String? locale;
  final CalendarType? calendarType;
  final String? timeZone;

  const UserInfo({
    this.id,
    required this.role,
    required this.planTitle,
    required this.authMethod,
    this.username,
    this.phoneNumber,
    this.email,
    this.avatarKey,
    required this.temporaryAvatar,
    this.locale,
    this.calendarType,
    this.timeZone,
  });

  factory UserInfo.fromJson(Map<String, dynamic> json) => UserInfo(
    id: json['_id'] as String?,
    role: json['role'] as String,
    planTitle: json['planTitle'] as String,
    authMethod: json['authMethod'] == 'phone' ? AuthMethod.phone : AuthMethod.email,
    username: json['username'] as String?,
    phoneNumber: json['phoneNumber'] as String?,
    email: json['email'] as String?,
    avatarKey: json['avatarKey'] as String?,
    temporaryAvatar: json['temporaryAvatar'] as bool,
    locale: json['locale'] as String?,
    calendarType: _parseCalendarType(json['calendarType'] as String?),
    timeZone: json['timeZone'] as String?,
  );

  static CalendarType? _parseCalendarType(String? value) {
    if (value == null) return null;
    for (final t in CalendarType.values) {
      if (t.name == value) return t;
    }
    return null;
  }

  Map<String, dynamic> toJson() => {
    '_id': id,
    'role': role,
    'planTitle': planTitle,
    'authMethod': authMethod.name,
    'username': username,
    'phoneNumber': phoneNumber,
    'email': email,
    'avatarKey': avatarKey,
    'temporaryAvatar': temporaryAvatar,
    'locale': locale,
    'calendarType': calendarType?.name,
    'timeZone': timeZone,
  };
}
