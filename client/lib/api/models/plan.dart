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

/// Mirrors `allowedContentTypes` from `privilegesSchema`.
class ContentTypeFlags {
  final bool string;
  final bool richText;
  final bool image;
  final bool audio;
  final bool video;

  const ContentTypeFlags({required this.string, required this.richText, required this.image, required this.audio, required this.video});

  factory ContentTypeFlags.fromJson(Map<String, dynamic> json) => ContentTypeFlags(
    string: json['string'] as bool,
    richText: json['richText'] as bool,
    image: json['image'] as bool,
    audio: json['audio'] as bool,
    video: json['video'] as bool,
  );

  Map<String, dynamic> toJson() => {
    'string': string.toString(),
    'richText': richText.toString(),
    'image': image.toString(),
    'audio': audio.toString(),
    'video': video.toString(),
  };
}

/// Mirrors `privilegesSchema`.
class Privileges {
  final int maxCategories;
  final int maxNestedCategories;
  final int maxCardsPerCategory;
  final int maxContentsPerCardSide;
  final int maxStorageBytes;
  final ContentTypeFlags allowedContentTypes;

  /// Per-content-type size caps (`maxValuePerContent`). Parsed but
  /// deliberately not surfaced as a marketing bullet on the pricing
  /// page — it's an internal limit, not something a prospective user
  /// is comparing plans on. Kept here in case a future "full spec"
  /// comparison view wants it.
  final Map<String, int> maxValuePerContent;

  const Privileges({
    required this.maxCategories,
    required this.maxNestedCategories,
    required this.maxCardsPerCategory,
    required this.maxContentsPerCardSide,
    required this.maxStorageBytes,
    required this.allowedContentTypes,
    required this.maxValuePerContent,
  });

  factory Privileges.fromJson(Map<String, dynamic> json) => Privileges(
    maxCategories: json['maxCategories'] as int,
    maxNestedCategories: json['maxNestedCategories'] as int,
    maxCardsPerCategory: json['maxCardsPerCategory'] as int,
    maxContentsPerCardSide: json['maxContentsPerCardSide'] as int,
    maxStorageBytes: json['maxStorageBytes'] as int,
    allowedContentTypes: ContentTypeFlags.fromJson(json['allowedContentTypes'] as Map<String, dynamic>),
    maxValuePerContent: Map<String, int>.from(json['maxValuePerContent'] as Map),
  );

  Map<String, dynamic> toJson() => {
    'maxCategories': maxCategories,
    'maxNestedCategories': maxNestedCategories,
    'maxCardsPerCategory': maxCardsPerCategory,
    'maxContentsPerCardSide': maxContentsPerCardSide,
    'maxStorageBytes': maxStorageBytes,
    'allowedContentTypes': allowedContentTypes.toJson(),
    'maxValuePerContent': maxValuePerContent,
  };
}

class Plan {
  final String id;
  final String title;
  final Price price;
  final Privileges privileges;

  const Plan({required this.id, required this.title, required this.price, required this.privileges});

  factory Plan.fromJson(Map<String, dynamic> json) => Plan(
    id: json['_id'] as String,
    title: json['title'] as String,
    price: Price.fromJson(json['price'] as Map<String, dynamic>),
    privileges: Privileges.fromJson(json['privileges'] as Map<String, dynamic>),
  );

  Map<String, dynamic> toJson() => {'_id': id, 'title': title, 'price': price.toJson(), 'privileges': privileges.toJson()};
}
