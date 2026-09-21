import 'package:client/plan/models/currency_label.dart';

/// Mirrors the backend's `priceSchema` — six currencies, each a
/// non-negative integer. The schema itself doesn't say what unit each
/// integer is in (whole units vs smallest subunit); see
/// CurrencyFormatter for the assumption this UI makes about that,
/// which you should confirm against your actual backend convention.
class Price {
  final int irr;
  final int irt;
  final int usd;
  final int eur;
  final int btc;
  final int eth;

  const Price({required this.irr, required this.irt, required this.usd, required this.eur, required this.btc, required this.eth});

  factory Price.fromJson(Map<String, dynamic> json) => Price(
    irr: json['IRR'] as int,
    irt: json['IRT'] as int,
    usd: json['USD'] as int,
    eur: json['EUR'] as int,
    btc: json['BTC'] as int,
    eth: json['ETH'] as int,
  );

  bool get isFree => irr == 0 && irt == 0 && usd == 0 && eur == 0 && btc == 0 && eth == 0;

  int forCurrency(Currency currency) {
    switch (currency) {
      case Currency.usd:
        return usd;
      case Currency.eur:
        return eur;
      case Currency.irt:
        return irt;
      case Currency.irr:
        return irr;
      case Currency.btc:
        return btc;
      case Currency.eth:
        return eth;
    }
  }

  Map<String, dynamic> toJson() => {'irr': irr, 'irt': irt, 'usd': usd, 'eur': eur, 'btc': btc, 'eth': eth};
}
