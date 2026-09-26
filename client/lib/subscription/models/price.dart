import 'package:client/plan/models/currency_label.dart';

/// Mirrors the backend's `priceSchema` — six currencies, each a
/// non-negative integer. The schema itself doesn't say what unit each
/// integer is in (whole units vs smallest subunit); see
/// CurrencyFormatter for the assumption this UI makes about that,
/// which you should confirm against your actual backend convention.
class Price {
  final Currency currency;
  final double amount;

  Price({required this.currency, required this.amount});

  factory Price.fromJson(Map<String, dynamic> json) => Price(currency: Currency.toCurrency(json['currency'] as String), amount: json['amount'] as double);

  Map<String, dynamic> toJson() => {'amount': amount, 'currency': currency.toString()};
}
