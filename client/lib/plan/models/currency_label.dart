enum Currency { usd, eur, irt, irr, btc, eth }

extension CurrencyLabel on Currency {
  String get label {
    switch (this) {
      case Currency.usd:
        return 'USD';
      case Currency.eur:
        return 'EUR';
      case Currency.irt:
        return 'Toman';
      case Currency.irr:
        return 'Rial';
      case Currency.btc:
        return 'BTC';
      case Currency.eth:
        return 'ETH';
    }
  }
}
