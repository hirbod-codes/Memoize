/// Mirrors the backend's response envelope:
///
/// ```ts
/// type a = {
///     status: 'success',
///     data: any
/// } | {
///     status: 'error',
///     error_code: string,
/// } | {
///     status: 'error',
///     message: string,
/// } | {
///     status: 'error',
///     messages: string[],
/// }
/// ```
///
/// This is the single place that knows how to read that shape. Everything
/// downstream (the interceptor, any manual call site) works with
/// [ApiResponse] instead of raw JSON.
sealed class ApiResponse {
  const ApiResponse();

  /// Parses a raw JSON body into the right variant. Returns null if the
  /// body doesn't match any known shape (e.g. a non-JSON error page from
  /// a proxy/load balancer, or a malformed response) — callers should
  /// treat null as "unrecognized, fall back to a generic message".
  static ApiResponse? tryParse(dynamic body) {
    if (body is! Map) return null;

    final status = body['status'];
    if (status == 'success') {
      return ApiSuccess(body['data']);
    }

    if (status == 'error') {
      final errorCode = body['error_code'];
      if (errorCode is String) return ApiErrorCode(errorCode);

      final message = body['message'];
      if (message is String) return ApiErrorMessage(message);

      final messages = body['messages'];
      if (messages is List) {
        return ApiErrorMessages(messages.map((e) => e.toString()).toList());
      }
    }

    return null;
  }
}

class ApiSuccess extends ApiResponse {
  final dynamic data;
  const ApiSuccess(this.data);
}

/// Error identified by a machine-readable code (e.g. `INVALID_CREDENTIALS`).
/// Needs a lookup table to become user-facing text — see error_codes.dart.
class ApiErrorCode extends ApiResponse {
  final String code;
  const ApiErrorCode(this.code);
}

/// Error with a single ready-to-display message from the backend.
class ApiErrorMessage extends ApiResponse {
  final String message;
  const ApiErrorMessage(this.message);
}

/// Error with multiple messages (e.g. several validation failures at once).
class ApiErrorMessages extends ApiResponse {
  final List<String> messages;
  const ApiErrorMessages(this.messages);
}
