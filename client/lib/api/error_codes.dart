import 'package:client/api/root_navigator_key.dart';
import 'package:client/l10n/app_localizations.dart';

/// Maps backend `error_code` values to user-facing text.
///
/// This is the one place that needs updating whenever the backend adds a
/// new error_code — everything else (interceptor, UI) is generic and
/// doesn't change. Codes not listed here fall back to a generic message
/// rather than showing the raw code to the user.
Map<String, String Function(AppLocalizations? l10n)> errorCodeMessages = {
  'INVALID_CREDENTIALS': (AppLocalizations? l10n) => l10n?.error_code_invalid_credentials ?? 'Incorrect email or password.',
  'EMAIL_ALREADY_REGISTERED': (AppLocalizations? l10n) => l10n?.error_code_email_already_registered ?? 'An account with this email already exists.',
  'OTP_FAILED': (AppLocalizations? l10n) => l10n?.error_code_otp_failed ?? 'unfortunately, we failed to send verification code.',
  'INVALID_OTP': (AppLocalizations? l10n) => l10n?.error_code_invalid_otp ?? 'That code is incorrect or expired.',
  'INVALID_CODE': (AppLocalizations? l10n) => l10n?.error_code_invalid_code ?? 'That code is incorrect or expired.',
  'OTP_EXPIRED': (AppLocalizations? l10n) => l10n?.error_code_otp_expired ?? 'That code has expired. Request a new one.',
  'OTP_RATE_LIMITED': (AppLocalizations? l10n) => l10n?.error_code_otp_rate_limited ?? 'Too many attempts. Please wait before trying again.',
  'ACCOUNT_NOT_FOUND': (AppLocalizations? l10n) => l10n?.error_code_account_not_found ?? 'No account found with that email or phone number.',
  'QUOTA_EXCEEDED': (AppLocalizations? l10n) => l10n?.error_code_quota_exceeded ?? "You've reached your plan's limit for this.",
  'FEATURE_NOT_AVAILABLE': (AppLocalizations? l10n) => l10n?.error_code_feature_not_available ?? 'This feature requires an upgraded plan.',
  'UNAUTHORIZED': (AppLocalizations? l10n) => l10n?.error_code_unauthorized ?? 'Your session has expired. Please log in again.',
  'UNSUPPORTED_PAYMENT_METHOD': (l10n) => '',
  'INTERNAL': (l10n) => '',
  'INTERNAL_ERROR': (l10n) => '',
  'PLAN_STATE_INVALID': (l10n) => '',
  'OTP_COOLDOWN': (l10n) => '',
  'PHONE_REGISTRATION_DISABLED': (l10n) => '',
  'CREATE_FAILED': (l10n) => '',
  'FETCH_FAILED': (l10n) => '',
  'EMAIL_REGISTRATION_DISABLED': (l10n) => '',
  'SMTP_COOLDOWN': (l10n) => '',
  'INVALID_INPUT': (l10n) => '',
  'EMAIL_NOT_FOUND': (l10n) => '',
  'UPDATE_FAILED': (l10n) => '',
  'NO_REFRESH_TOKEN': (l10n) => '',
  'REFRESH_INVALID': (l10n) => '',
  'INVALID_PLAN': (l10n) => '',
  'USER_HAS_NO_ACTIVE_PLAN': (l10n) => '',
  'PLAN_ALREADY_ACTIVE': (l10n) => '',
  'MUST_USE_SAME_PAYMENT_METHOD_AS_PRECIOUS_PLAN': (l10n) => '',
  'USER_HAS_ACTIVE_PLAN': (l10n) => '',
  'UPLOAD_FAILED': (l10n) => '',
  'USER_NOT_FOUND': (l10n) => '',
  'AVATAR_NOT_FOUND': (l10n) => '',
};

String messageForErrorCode(String code) {
  final m = errorCodeMessages[code];
  if (m != null) {
    return m(rootContext == null ? null : AppLocalizations.of(rootContext!));
  } else {
    return 'Something went wrong. Please try again.';
  }
}
