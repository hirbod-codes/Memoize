/// Maps backend `error_code` values to user-facing text.
///
/// This is the one place that needs updating whenever the backend adds a
/// new error_code — everything else (interceptor, UI) is generic and
/// doesn't change. Codes not listed here fall back to a generic message
/// rather than showing the raw code to the user.
const Map<String, String> errorCodeMessages = {
  'INVALID_CREDENTIALS': 'Incorrect email or password.',
  'EMAIL_ALREADY_REGISTERED': 'An account with this email already exists.',
  'INVALID_OTP': 'That code is incorrect or expired.',
  'INVALID_CODE': 'That code is incorrect or expired.',
  'OTP_EXPIRED': 'That code has expired. Request a new one.',
  'OTP_RATE_LIMITED': 'Too many attempts. Please wait before trying again.',
  'ACCOUNT_NOT_FOUND': 'No account found with that email or phone number.',
  'QUOTA_EXCEEDED': "You've reached your plan's limit for this.",
  'FEATURE_NOT_AVAILABLE': 'This feature requires an upgraded plan.',
  'UNAUTHORIZED': 'Your session has expired. Please log in again.',
};

String messageForErrorCode(String code) {
  return errorCodeMessages[code] ?? 'Something went wrong. Please try again.';
}
