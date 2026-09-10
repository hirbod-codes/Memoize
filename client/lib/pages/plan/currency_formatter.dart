import 'package:client/api/models/plan.dart';

/// Formats a raw integer price for display.
///
/// ASSUMPTION — confirm this against your actual backend before shipping:
/// the schema only guarantees a non-negative integer, it doesn't specify
/// the unit. This assumes the common convention of storing money in the
/// smallest subunit to avoid floating-point rounding bugs:
///   - USD/EUR stored in cents (divide by 100)
///   - IRT/IRR stored as whole Toman/Rial (Iran doesn't really use a
///     fractional subunit in practice, so no division)
///   - BTC stored in satoshis (divide by 100,000,000)
///   - ETH stored in wei (divide by 10^18)
/// If your backend uses a different convention, this is the one place
/// to change it — nothing else in the UI knows or cares about units.
class CurrencyFormatter {
  static String format(int rawValue, Currency currency) {
    switch (currency) {
      case Currency.usd:
        return '\$${_decimal(rawValue, 100, 2)}';
      case Currency.eur:
        return '€${_decimal(rawValue, 100, 2)}';
      case Currency.irt:
        return '${_thousands(rawValue)} Toman';
      case Currency.irr:
        return '${_thousands(rawValue)} Rial';
      case Currency.btc:
        return '${_trimmed(rawValue, 100000000, 8)} BTC';
      case Currency.eth:
        return '${_trimmed(rawValue, 1000000000000000000, 8)} ETH';
    }
  }

  static String _decimal(int raw, int divisor, int places) {
    return (raw / divisor).toStringAsFixed(places);
  }

  static String _thousands(int raw) {
    return raw.toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }

  /// For crypto: show up to [maxDecimals] places but trim trailing
  /// zeros, so a whole-coin price doesn't render as "1.00000000 BTC".
  static String _trimmed(int raw, int divisor, int maxDecimals) {
    var s = (raw / divisor).toStringAsFixed(maxDecimals);
    if (s.contains('.')) {
      s = s.replaceAll(RegExp(r'0+$'), '').replaceAll(RegExp(r'\.$'), '');
    }
    return s;
  }
}

/// Human-readable byte formatting for `maxStorageBytes` (e.g. "5 GB").
String formatBytes(int bytes) {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  var value = bytes.toDouble();
  var unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  final formatted = value == value.roundToDouble() ? value.toStringAsFixed(0) : value.toStringAsFixed(1);
  return '$formatted ${units[unitIndex]}';
}

/// Thousands-separated integer, for limits like "5,000 cards".
String formatCount(int value) {
  return value.toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
}
