import 'payment_method.dart';
import 'price.dart';
import 'privileges.dart';
import 'status.dart';

class Subscription {
  final String id;
  final Status status;
  final String planTitle;
  final Price price;
  final Privileges privileges;
  final int currentPeriodEnd;
  final PaymentMethod paymentMethod;

  const Subscription({
    required this.id,
    required this.planTitle,
    required this.price,
    required this.privileges,
    required this.status,
    required this.currentPeriodEnd,
    required this.paymentMethod,
  });

  factory Subscription.fromJson(Map<String, dynamic> json) => Subscription(
    id: json['_id'] as String,
    status: toStatus(json['status'] as String),
    planTitle: json['planTitle'] as String,
    price: Price.fromJson(json['price'] as Map<String, dynamic>),
    privileges: Privileges.fromJson(json['privileges'] as Map<String, dynamic>),
    currentPeriodEnd: json['currentPeriodEnd'] as int,
    paymentMethod: toPaymentMethod(json['paymentMethod'] as String),
  );

  Map<String, dynamic> toJson() => {
    '_id': id,
    'status': status.name,
    'planTitle': planTitle,
    'price': price.toJson(),
    'privileges': privileges.toJson(),
    'currentPeriodEnd': currentPeriodEnd,
    'paymentMethod': paymentMethod.name,
  };
}
