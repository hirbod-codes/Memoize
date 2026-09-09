import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:client/api/models/plan.dart';
import 'package:talker/talker.dart';
import 'currency_formatter.dart';
import 'plans_provider.dart';

/// Public pricing page. No auth required — this is meant to be
/// reachable by anyone, logged in or not, which is why it goes through
/// plansProvider's plain dioProvider rather than anything auth-related.
///
/// [onSelectPlan] fires when someone taps a plan's CTA button. Wire it
/// to whatever your app's actual next step is — e.g. navigate to
/// /login?plan=<id> so signup can pre-select that plan, or straight to
/// checkout if the user's already authenticated. Left as a callback
/// since that routing decision depends on your app's flow, not
/// something this page should assume.
class PricingPage extends ConsumerWidget {
  final ValueChanged<Plan>? onSelectPlan;

  const PricingPage({super.key, this.onSelectPlan});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plansAsync = ref.watch(plansProvider);

    return Scaffold(
      body: SafeArea(
        child: plansAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) {
            Talker().error('plansProvider threw an error', error, stackTrace);
            return _RetryState(message: "Couldn't load pricing right now.", onRetry: () => ref.invalidate(plansProvider));
          },
          data: (plans) {
            if (plans.isEmpty) return const _RetryState(message: 'No plans are available right now.');

            return _PricingContent(plans: plans, onSelectPlan: onSelectPlan);
          },
        ),
      ),
    );
  }
}

class _PricingContent extends StatefulWidget {
  final List<Plan> plans;
  final ValueChanged<Plan>? onSelectPlan;

  const _PricingContent({required this.plans, this.onSelectPlan});

  @override
  State<_PricingContent> createState() => _PricingContentState();
}

class _PricingContentState extends State<_PricingContent> {
  Currency _currency = Currency.usd;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 16),
          Text('Choose your plan', style: Theme.of(context).textTheme.headlineMedium, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text('Pick the plan that fits how you use Memoize.', style: Theme.of(context).textTheme.bodyLarge, textAlign: TextAlign.center),
          const SizedBox(height: 24),
          Center(
            child: SegmentedButton<Currency>(
              segments: Currency.values.map((c) => ButtonSegment(value: c, label: Text(c.label))).toList(),
              selected: {_currency},
              onSelectionChanged: (selection) => setState(() => _currency = selection.first),
              showSelectedIcon: false,
            ),
          ),
          const SizedBox(height: 32),
          LayoutBuilder(
            builder: (context, constraints) {
              final isWide = constraints.maxWidth > 900;
              if (isWide) {
                return IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final plan in widget.plans) ...[
                        Expanded(
                          child: _PlanCard(plan: plan, currency: _currency, onSelect: widget.onSelectPlan),
                        ),
                        if (plan != widget.plans.last) const SizedBox(width: 16),
                      ],
                    ],
                  ),
                );
              }
              return Column(
                children: [
                  for (final plan in widget.plans) ...[_PlanCard(plan: plan, currency: _currency, onSelect: widget.onSelectPlan), if (plan != widget.plans.last) const SizedBox(height: 16)],
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  final Plan plan;
  final Currency currency;
  final ValueChanged<Plan>? onSelect;

  const _PlanCard({required this.plan, required this.currency, this.onSelect});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final price = plan.price;
    final privileges = plan.privileges;

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(plan.title, style: theme.textTheme.titleLarge),
            const SizedBox(height: 12),
            Text(price.isFree ? 'Free' : CurrencyFormatter.format(price.forCurrency(currency), currency), style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            const Divider(height: 1),
            const SizedBox(height: 20),
            _Feature(icon: Icons.folder_outlined, text: '${formatCount(privileges.maxCategories)} categories'),
            _Feature(icon: Icons.account_tree_outlined, text: '${formatCount(privileges.maxNestedCategories)} levels of nesting'),
            _Feature(icon: Icons.style_outlined, text: '${formatCount(privileges.maxCardsPerCategory)} cards per category'),
            _Feature(icon: Icons.view_agenda_outlined, text: '${formatCount(privileges.maxContentsPerCardSide)} contents per card side'),
            _Feature(icon: Icons.storage_outlined, text: '${formatBytes(privileges.maxStorageBytes)} storage'),
            const SizedBox(height: 12),
            Text('Content types', style: theme.textTheme.labelLarge),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                _ContentTypeChip(label: 'Text', enabled: privileges.allowedContentTypes.string, icon: Icons.text_fields),
                _ContentTypeChip(label: 'Rich text', enabled: privileges.allowedContentTypes.richText, icon: Icons.article_outlined),
                _ContentTypeChip(label: 'Image', enabled: privileges.allowedContentTypes.image, icon: Icons.image_outlined),
                _ContentTypeChip(label: 'Audio', enabled: privileges.allowedContentTypes.audio, icon: Icons.audiotrack_outlined),
                _ContentTypeChip(label: 'Video', enabled: privileges.allowedContentTypes.video, icon: Icons.videocam_outlined),
              ],
            ),
            const SizedBox(height: 24),
            FilledButton(onPressed: onSelect == null ? null : () => onSelect!(plan), child: const Text('Get started')),
          ],
        ),
      ),
    );
  }
}

class _Feature extends StatelessWidget {
  final IconData icon;
  final String text;

  const _Feature({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: Theme.of(context).textTheme.bodyMedium)),
        ],
      ),
    );
  }
}

class _ContentTypeChip extends StatelessWidget {
  final String label;
  final bool enabled;
  final IconData icon;

  const _ContentTypeChip({required this.label, required this.enabled, required this.icon});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = enabled ? theme.colorScheme.primary : theme.disabledColor;

    return Opacity(
      opacity: enabled ? 1.0 : 0.5,
      child: Chip(
        avatar: Icon(enabled ? Icons.check_circle : Icons.cancel_outlined, size: 16, color: color),
        label: Text(label, style: TextStyle(color: color)),
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}

class _RetryState extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;

  const _RetryState({required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge),
            if (onRetry != null) ...[const SizedBox(height: 16), OutlinedButton(onPressed: onRetry, child: const Text('Try again'))],
          ],
        ),
      ),
    );
  }
}
