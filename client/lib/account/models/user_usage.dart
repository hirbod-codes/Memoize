class UserUsage {
  final String _id;
  final int storageBytesCount;

  const UserUsage({required String id, required this.storageBytesCount}) : _id = id;

  factory UserUsage.fromJson(Map<String, dynamic> json) => UserUsage(id: json['_id'] as String, storageBytesCount: json['storageBytesCount'] as int);

  Map<String, dynamic> toJson() => {'_id': _id, 'storageBytesCount': storageBytesCount};
}
