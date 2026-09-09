import 'package:client/components/footer/app_footer.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;

    if (width < 600) {
      return const MobileHomePage();
    }

    // Tablet
    if (width < 1024) {
      return const MobileHomePage();
    }

    return MobileHomePage();
  }
}

enum Filter { folder, file }

class MobileHomePage extends ConsumerStatefulWidget {
  const MobileHomePage({super.key});

  @override
  ConsumerState<MobileHomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<MobileHomePage> {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(child: Text('Home Page')),
        if (kIsWeb) const AppFooter(),
      ],
    );
  }
}
