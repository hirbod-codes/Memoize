import 'package:client/api/api_response.dart';
import 'package:client/api/error_codes.dart';
import 'package:client/api/root_navigator_key.dart';
import 'package:client/components/global/notification_service.dart';
import 'package:dio/dio.dart';
import 'package:talker/talker.dart';

/// Distinguishes "the call failed" from "the call succeeded and the
/// data happened to be null" (e.g. a 204 No Content response) — a
/// plain `T?` return can't tell these apart, since both would just be
/// `null`. Pattern-match on this instead:
///
///   final result = await apiCall<Map<String, dynamic>>(() => authDio.delete('/api/thing'));
///   switch (result) {
///     case ApiCallSuccess(:final data):
///       // data may itself be null (204) — that's fine, this branch
///       // only runs on genuine success either way.
///     case ApiCallFailure(:final message):
///       // request failed; message is already shown as a toast too.
///   }
sealed class ApiCallResult<T> {
  const ApiCallResult();

  bool get isSuccess => this is ApiCallSuccess<T>;
  bool get isFailure => this is ApiCallFailure<T>;

  /// Convenience for callers that don't care about the failure message,
  /// only whether they got usable data. Returns null for BOTH a failed
  /// call and a successful-but-null one — only use this when that
  /// ambiguity genuinely doesn't matter to the caller; otherwise switch
  /// on the sealed type directly.
  T? get dataOrNull => switch (this) {
    ApiCallSuccess<T>(:final data) => data,
    ApiCallFailure<T>() => null,
  };
}

class ApiCallSuccess<T> extends ApiCallResult<T> {
  final T? data;
  const ApiCallSuccess(this.data);
}

class ApiCallFailure<T> extends ApiCallResult<T> {
  final String message;
  const ApiCallFailure(this.message);
}

/// Call this instead of a raw dio.get/post/etc anywhere you want
/// automatic error-toast handling across every failure shape, plus
/// automatic `data` unwrapping on success.
///
/// Failure handling covers:
///  1. Non-2xx HTTP, OR a 2xx response whose body isn't a recognized
///     `{status:'success', data:...}` envelope — extracts message/
///     error_code/error from the body if present, generic otherwise.
///  2. Anything else thrown that isn't even a DioException — generic
///     toast, since nothing else in the pipeline would show one.
///
/// A 204 (or any 2xx with a genuinely empty body) is treated as success
/// with `data: null` directly — it never reaches the envelope parser at
/// all, since there's nothing to parse and an empty body would
/// otherwise look identical to a malformed response.
///
/// Success messaging is NOT automatic. Chain `.notifyOnSuccess('...')`
/// onto the request future yourself when you want one:
///
///   final result = await apiCall<void>(
///     () => authDio.post('/api/auth/login', data: {...}).notifyOnSuccess('Welcome back!'),
///   );
///
/// Overlaps with GlobalErrorInterceptor for the non-2xx HTTP case — if
/// you adopt apiCall broadly, consider stripping the toast call out of
/// GlobalErrorInterceptor (keep it for logging only) so a single
/// failure can't show two toasts.
Future<ApiCallResult<T>> apiCall<T>(Future<Response> Function() request) async {
  try {
    final response = await request();

    if (response.statusCode != null && response.statusCode! >= 200 && response.statusCode! < 300 && (response.data == null || response.data == '')) {
      return ApiCallSuccess<T>(null);
    }

    final parsed = ApiResponse.tryParse(response.data);
    if (parsed is ApiSuccess) return ApiCallSuccess<T>(parsed.data as T?);

    final message = _extractMessage(parsed, response.data);
    _showError(message);
    return ApiCallFailure<T>(message);
  } on DioException catch (e) {
    final message = _extractMessage(ApiResponse.tryParse(e.response?.data), e.response?.data);
    _showError(message);
    return ApiCallFailure<T>(message);
  } catch (e, st) {
    Talker().error('apiCall: unexpected error', e, st);
    const message = 'Something went wrong.';
    _showError(message);
    return ApiCallFailure<T>(message);
  }
}

String _extractMessage(ApiResponse? parsed, dynamic rawBody) {
  switch (parsed) {
    case ApiErrorCode(:final code):
      return messageForErrorCode(code);
    case ApiErrorMessage(:final message):
      return message;
    case ApiErrorMessages(:final messages):
      return messages.join('\n');
    default:
      if (rawBody is Map) {
        final fallback = rawBody['message'] ?? rawBody['error'];
        if (fallback is String && fallback.isNotEmpty) return fallback;
      }
      return 'Something went wrong.';
  }
}

void _showError(String message) {
  final context = rootContext;
  if (context != null) {
    NotificationService.showError(context: context, message: message);
  }
}
