import 'package:client/components/button.dart';
import 'package:client/components/footer/app_footer.dart';
import 'package:client/localization/components/locale_switcher.dart';
import 'package:client/localization/locale_controller.dart';
import 'package:client/localization/on_boarding_status.dart';
import 'package:client/theme/theme_colors.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Public marketing page — no auth chrome, meant to be wrapped in
/// PublicShell at the route level, not AppShell. Only ever rendered
/// while unauthenticated: go_router's redirect immediately bounces an
/// authenticated visitor away from '/' to '/app' before this ever
/// builds, so no auth-conditional logic is needed inside here at all.
class LandingPage extends ConsumerStatefulWidget {
  const LandingPage({super.key});

  @override
  ConsumerState<LandingPage> createState() => _LandingPageState();
}

class _LandingPageState extends ConsumerState<LandingPage> {
  @override
  void initState() {
    super.initState();
    // Deferred to after the first frame — showDialog needs a Navigator/
    // Overlay above it in the tree, which isn't guaranteed to exist yet
    // synchronously inside initState.
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybePromptLanguage());
  }

  Future<void> _maybePromptLanguage() async {
    final alreadyChosen = await hasChosenLocale();
    if (alreadyChosen || !mounted) return;

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Choose your language'),
        content: const LocaleSwitcher(),
        actions: [
          FilledButton(
            onPressed: () async {
              // Persist whatever's currently selected — even the
              // device-derived default the switcher already shows —
              // so this dialog never asks again once dismissed.
              final locale = ref.read(localeControllerProvider);
              await ref.read(localeControllerProvider.notifier).setLocale(locale);
              if (dialogContext.mounted) Navigator.of(dialogContext).pop();
            },
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      child: Column(children: [_LandingHeader(), _HeroSection(), _HowItWorksSection(), _ContentTypesSection(), _UseCasesSection(), _FinalCtaSection(), AppFooter()]),
    );
  }
}

/// Two-row header, unique to the landing page: app name + locale/theme
/// controls + "Log in" on the first row, marketing nav links (Pricing,
/// About us, Contact us — the pages themselves are stubbed for now) on
/// the second. Built here rather than as a PublicShell feature, since
/// other pages using PublicShell will likely want a different header
/// entirely (see public_shell.dart's own reasoning on this).
class _LandingHeader extends ConsumerWidget {
  const _LandingHeader();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Text('Memoize', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
              const Spacer(),
              const LocaleSwitcher(),
              const SizedBox(width: 4),
              Button(
                icon: ref.watch(themeModeProvider) == ThemeMode.dark ? Icons.light_mode : Icons.dark_mode,
                color: ThemeColorName.primary,
                type: ButtonType.text,
                onPressed: () => ref.read(themeModeProvider.notifier).toggle(),
              ),
              const SizedBox(width: 8),
              FilledButton(onPressed: () => context.go('/login'), child: const Text('Log in')),
            ],
          ),
        ),
        const Divider(height: 1),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Wrap(
            spacing: 8,
            children: [
              TextButton(onPressed: () => context.go('/pricing'), child: const Text('Pricing')),
              TextButton(onPressed: () => context.go('/about'), child: const Text('About us')),
              TextButton(onPressed: () => context.go('/contact'), child: const Text('Contact us')),
            ],
          ),
        ),
      ],
    );
  }
}

class _HeroSection extends StatelessWidget {
  const _HeroSection();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 80),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: Column(
            children: [
              Text(
                'MEMORIZE ANYTHING',
                style: theme.textTheme.labelLarge?.copyWith(color: theme.colorScheme.primary, letterSpacing: 2, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              Text(
                'Turn your own material into flashcards you actually remember',
                textAlign: TextAlign.center,
                style: theme.textTheme.displaySmall?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              Text(
                'Upload text, images, audio, or video — organize it however makes '
                'sense to you — and review it whenever you have a few minutes.',
                textAlign: TextAlign.center,
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: 32),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                alignment: WrapAlignment.center,
                children: [
                  FilledButton(
                    onPressed: () => context.go('/login'),
                    child: const Padding(padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4), child: Text('Get started free')),
                  ),
                  OutlinedButton(
                    onPressed: () => context.go('/pricing'),
                    child: const Padding(padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4), child: Text('See pricing')),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HowItWorksSection extends StatelessWidget {
  const _HowItWorksSection();

  static const _steps = [
    (icon: Icons.upload_file_outlined, title: 'Upload your content', description: 'Text, images, audio, or video — right onto either side of a card.'),
    (
      icon: Icons.account_tree_outlined,
      title: 'Organize it your way',
      description: 'Nest categories as deep as you need — by subject, by chapter, by whatever makes sense to you.',
    ),
    (icon: Icons.replay_outlined, title: 'Come back and review', description: 'Work through your cards whenever you have a few spare minutes.'),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      color: theme.colorScheme.surfaceContainerLow,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 64),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1100),
          child: Column(
            children: [
              Text('How it works', style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 40),
              LayoutBuilder(
                builder: (context, constraints) {
                  final isWide = constraints.maxWidth > 800;
                  final children = [for (final step in _steps) _StepCard(icon: step.icon, title: step.title, description: step.description)];
                  return isWide
                      ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: _withGaps(children, 24, horizontal: true))
                      : Column(children: _withGaps(children, 24, horizontal: false));
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StepCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;

  const _StepCard({required this.icon, required this.title, required this.description});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 32, color: theme.colorScheme.primary),
        const SizedBox(height: 12),
        Text(title, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Text(description, style: theme.textTheme.bodyMedium),
      ],
    );
  }
}

class _ContentTypesSection extends StatelessWidget {
  const _ContentTypesSection();

  static const _types = [
    (icon: Icons.text_fields, label: 'Text'),
    (icon: Icons.article_outlined, label: 'Rich text'),
    (icon: Icons.image_outlined, label: 'Images'),
    (icon: Icons.audiotrack_outlined, label: 'Audio'),
    (icon: Icons.videocam_outlined, label: 'Video'),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 64),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 900),
          child: Column(
            children: [
              Text(
                'Any kind of content, on either side of a card',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Text(
                "A vocabulary word with its pronunciation. A diagram next to your own explanation. It's your material — Memoize doesn't limit how you represent it.",
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge,
              ),
              const SizedBox(height: 32),
              Wrap(
                spacing: 24,
                runSpacing: 24,
                alignment: WrapAlignment.center,
                children: [
                  for (final type in _types)
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircleAvatar(
                          radius: 28,
                          backgroundColor: theme.colorScheme.primaryContainer,
                          child: Icon(type.icon, color: theme.colorScheme.onPrimaryContainer),
                        ),
                        const SizedBox(height: 8),
                        Text(type.label, style: theme.textTheme.bodyMedium),
                      ],
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UseCasesSection extends StatelessWidget {
  const _UseCasesSection();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      color: theme.colorScheme.surfaceContainerLow,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 64),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1000),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final isWide = constraints.maxWidth > 700;
              const cards = [
                _UseCaseCard(
                  icon: Icons.translate,
                  title: 'Learning a new language',
                  description:
                      'Pair a word with an audio clip of its pronunciation and a picture instead of just a translation — build cards the way you actually think about the word.',
                ),
                _UseCaseCard(
                  icon: Icons.school_outlined,
                  title: 'Studying for an exam',
                  description:
                      'Turn lecture slides, diagrams, and your own notes into cards organized by subject and chapter, nested exactly the way your course is structured.',
                ),
              ];
              return isWide
                  ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: _withGaps(cards, 24, horizontal: true))
                  : Column(children: _withGaps(cards, 24, horizontal: false));
            },
          ),
        ),
      ),
    );
  }
}

class _UseCaseCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;

  const _UseCaseCard({required this.icon, required this.title, required this.description});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      color: theme.colorScheme.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 28, color: theme.colorScheme.primary),
            const SizedBox(height: 12),
            Text(title, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(description, style: theme.textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}

class _FinalCtaSection extends StatelessWidget {
  const _FinalCtaSection();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 72),
      child: Center(
        child: Column(
          children: [
            Text('Ready to remember more?', style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => context.go('/login'),
              child: const Padding(padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8), child: Text('Get started free')),
            ),
          ],
        ),
      ),
    );
  }
}

List<Widget> _withGaps(List<Widget> children, double gap, {required bool horizontal}) {
  final result = <Widget>[];
  for (var i = 0; i < children.length; i++) {
    if (horizontal) {
      result.add(Expanded(child: children[i]));
    } else {
      result.add(children[i]);
    }
    if (i < children.length - 1) {
      result.add(horizontal ? SizedBox(width: gap) : SizedBox(height: gap));
    }
  }
  return result;
}
