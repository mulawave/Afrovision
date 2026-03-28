# Premium Card Templates

Ready-to-use card widget templates. Copy, rename, and customize.

## Pricing / Subscription Plan Card

```dart
class PlanCard extends StatelessWidget {
  final String name;
  final String price;
  final String period;
  final List<String> features;
  final bool isPopular;
  final bool isCurrentPlan;
  final VoidCallback? onSelect;

  const PlanCard({
    super.key,
    required this.name,
    required this.price,
    required this.period,
    required this.features,
    this.isPopular = false,
    this.isCurrentPlan = false,
    this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = isPopular ? AppColors.orange : AppColors.lightOrange;
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isPopular
              ? AppColors.orange.withValues(alpha: 0.5)
              : AppColors.inputBorder.withValues(alpha: 0.3),
          width: isPopular ? 1.5 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
          if (isPopular)
            BoxShadow(
              color: AppColors.orange.withValues(alpha: 0.15),
              blurRadius: 24,
              spreadRadius: 0,
            ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(name.toUpperCase(), style: TextStyle(
                color: accentColor, fontSize: 13,
                fontWeight: FontWeight.w700, letterSpacing: 1.5,
              )),
              if (isPopular)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    gradient: AppColors.buttonGradient,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text('POPULAR', style: TextStyle(
                    color: AppColors.darkBlue, fontSize: 10,
                    fontWeight: FontWeight.w800, letterSpacing: 1,
                  )),
                ),
            ],
          ),
          const SizedBox(height: 16),
          // Price
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(price, style: const TextStyle(
                color: AppColors.white, fontSize: 36, fontWeight: FontWeight.w800,
              )),
              const SizedBox(width: 6),
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text('/$period', style: TextStyle(
                  color: AppColors.hintText, fontSize: 14, fontWeight: FontWeight.w500,
                )),
              ),
            ],
          ),
          const SizedBox(height: 20),
          // Feature list
          ...features.map((f) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                Icon(Icons.check_circle, color: accentColor, size: 18),
                const SizedBox(width: 10),
                Expanded(child: Text(f, style: const TextStyle(
                  color: AppColors.white, fontSize: 14, fontWeight: FontWeight.w500,
                ))),
              ],
            ),
          )),
          const SizedBox(height: 20),
          // CTA
          AppButton(
            label: isCurrentPlan ? 'CURRENT PLAN' : 'SELECT PLAN',
            enabled: !isCurrentPlan,
            onPressed: onSelect,
          ),
        ],
      ),
    );
  }
}
```

## Profile / User Info Card

```dart
class ProfileInfoCard extends StatelessWidget {
  final String name;
  final String email;
  final String? avatarUrl;
  final String role;
  final VoidCallback? onEdit;

  const ProfileInfoCard({
    super.key,
    required this.name,
    required this.email,
    this.avatarUrl,
    required this.role,
    this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    final initials = name.isNotEmpty
        ? name.split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase()
        : '?';

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: [
          // Avatar
          Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.orange.withValues(alpha: 0.4), width: 2),
              boxShadow: [
                BoxShadow(
                  color: AppColors.orange.withValues(alpha: 0.25),
                  blurRadius: 20, spreadRadius: 2,
                ),
              ],
            ),
            child: CircleAvatar(
              radius: 40,
              backgroundColor: AppColors.cardBg,
              backgroundImage: avatarUrl != null ? NetworkImage(avatarUrl!) : null,
              child: avatarUrl == null
                  ? Text(initials, style: const TextStyle(
                      color: AppColors.orange, fontSize: 24, fontWeight: FontWeight.w700,
                    ))
                  : null,
            ),
          ),
          const SizedBox(height: 16),
          Text(name, style: const TextStyle(
            color: AppColors.white, fontSize: 20, fontWeight: FontWeight.w700,
          )),
          const SizedBox(height: 4),
          Text(email, style: const TextStyle(
            color: AppColors.hintText, fontSize: 14, fontWeight: FontWeight.w400,
          )),
          const SizedBox(height: 12),
          RoleBadge(role: role),
          if (onEdit != null) ...[
            const SizedBox(height: 20),
            AppButton(label: 'EDIT PROFILE', onPressed: onEdit),
          ],
        ],
      ),
    );
  }
}
```

## Channel / Content Tile Card

```dart
class ChannelTileCard extends StatelessWidget {
  final String title;
  final String description;
  final String? imageUrl;
  final int subscriberCount;
  final bool isLive;
  final VoidCallback? onTap;

  const ChannelTileCard({
    super.key,
    required this.title,
    required this.description,
    this.imageUrl,
    required this.subscriberCount,
    this.isLive = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      splashColor: AppColors.white.withValues(alpha: 0.1),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image header
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              child: Stack(
                children: [
                  Container(
                    height: 120,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.lightBlue.withValues(alpha: 0.5),
                          AppColors.darkBlue,
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: imageUrl != null
                        ? Image.network(imageUrl!, fit: BoxFit.cover)
                        : Center(child: Icon(
                            Icons.tv_rounded, color: AppColors.orange.withValues(alpha: 0.4), size: 40,
                          )),
                  ),
                  if (isLive)
                    Positioned(
                      top: 10, right: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.errorRed,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text('LIVE', style: TextStyle(
                          color: AppColors.white, fontSize: 10,
                          fontWeight: FontWeight.w800, letterSpacing: 1,
                        )),
                      ),
                    ),
                ],
              ),
            ),
            // Content
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(
                    color: AppColors.white, fontSize: 16, fontWeight: FontWeight.w700,
                  ), maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  Text(description, style: const TextStyle(
                    color: AppColors.hintText, fontSize: 13, fontWeight: FontWeight.w400,
                  ), maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(Icons.people_rounded, color: AppColors.lightOrange, size: 16),
                      const SizedBox(width: 6),
                      Text('$subscriberCount subscribers', style: const TextStyle(
                        color: AppColors.lightOrange, fontSize: 12, fontWeight: FontWeight.w600,
                      )),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

## Notification / Activity Card

```dart
class NotificationCard extends StatelessWidget {
  final IconData icon;
  final Color accentColor;
  final String title;
  final String message;
  final String timeAgo;
  final bool isUnread;
  final VoidCallback? onTap;

  const NotificationCard({
    super.key,
    required this.icon,
    this.accentColor = const Color(0xFFF49617),
    required this.title,
    required this.message,
    required this.timeAgo,
    this.isUnread = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      splashColor: AppColors.white.withValues(alpha: 0.1),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isUnread
              ? AppColors.cardBg.withValues(alpha: 0.9)
              : AppColors.cardBg.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isUnread
                ? accentColor.withValues(alpha: 0.3)
                : AppColors.inputBorder.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: accentColor, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(
                    color: AppColors.white, fontSize: 14,
                    fontWeight: isUnread ? FontWeight.w700 : FontWeight.w600,
                  )),
                  const SizedBox(height: 4),
                  Text(message, style: const TextStyle(
                    color: AppColors.hintText, fontSize: 13, fontWeight: FontWeight.w400,
                  ), maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 6),
                  Text(timeAgo, style: TextStyle(
                    color: AppColors.hintText.withValues(alpha: 0.6),
                    fontSize: 11, fontWeight: FontWeight.w500,
                  )),
                ],
              ),
            ),
            if (isUnread)
              Container(
                width: 8, height: 8,
                margin: const EdgeInsets.only(top: 4),
                decoration: BoxDecoration(
                  color: accentColor,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
```

## Wallet / Balance Card (vPT Style)

Based on the existing vPT balance card pattern in the codebase.

```dart
class WalletBalanceCard extends StatelessWidget {
  final String balance;
  final String currencySymbol;
  final String? equivalentLabel;
  final String? equivalentValue;
  final String statusLabel;
  final Color statusColor;
  final VoidCallback? onTopUp;
  final VoidCallback? onHistory;

  const WalletBalanceCard({
    super.key,
    required this.balance,
    this.currencySymbol = 'vPT',
    this.equivalentLabel,
    this.equivalentValue,
    this.statusLabel = 'Active',
    this.statusColor = const Color(0xFF00E676),
    this.onTopUp,
    this.onHistory,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.orange.withValues(alpha: 0.25)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: AppColors.orange.withValues(alpha: 0.08),
            blurRadius: 24,
            spreadRadius: 0,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.orange.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.account_balance_wallet_rounded,
                        color: AppColors.orange, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Text(currencySymbol.toUpperCase(), style: const TextStyle(
                    color: AppColors.lightOrange, fontSize: 13,
                    fontWeight: FontWeight.w700, letterSpacing: 1.5,
                  )),
                ],
              ),
              // Status badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: statusColor.withValues(alpha: 0.4)),
                ),
                child: Text(statusLabel, style: TextStyle(
                  color: statusColor, fontSize: 11,
                  fontWeight: FontWeight.w700, letterSpacing: 0.5,
                )),
              ),
            ],
          ),
          const SizedBox(height: 24),
          // Balance display
          Text(balance, style: const TextStyle(
            color: AppColors.white, fontSize: 36, fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
          )),
          if (equivalentLabel != null && equivalentValue != null) ...[
            const SizedBox(height: 6),
            Text('≈ $equivalentValue $equivalentLabel', style: TextStyle(
              color: AppColors.hintText, fontSize: 14, fontWeight: FontWeight.w500,
            )),
          ],
          const SizedBox(height: 24),
          // Action buttons row
          Row(
            children: [
              Expanded(
                child: _WalletAction(
                  icon: Icons.add_rounded,
                  label: 'Top Up',
                  onTap: onTopUp,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: _WalletAction(
                  icon: Icons.history_rounded,
                  label: 'History',
                  onTap: onHistory,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _WalletAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  const _WalletAction({required this.icon, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      splashColor: AppColors.white.withValues(alpha: 0.1),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.inputFill,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.4)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: AppColors.orange, size: 18),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(
              color: AppColors.white, fontSize: 14, fontWeight: FontWeight.w600,
            )),
          ],
        ),
      ),
    );
  }
}
```

## Leaderboard Row

Ranked list item for top creators, top channels, points standings.

```dart
class LeaderboardRow extends StatelessWidget {
  final int rank;
  final String name;
  final String subtitle;
  final String value;
  final String? avatarUrl;
  final VoidCallback? onTap;

  const LeaderboardRow({
    super.key,
    required this.rank,
    required this.name,
    required this.subtitle,
    required this.value,
    this.avatarUrl,
    this.onTap,
  });

  Color get _rankColor {
    switch (rank) {
      case 1: return const Color(0xFFFFD700); // Gold
      case 2: return const Color(0xFFC0C0C0); // Silver
      case 3: return const Color(0xFFCD7F32); // Bronze
      default: return AppColors.hintText;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isTop3 = rank <= 3;
    final initials = name.isNotEmpty
        ? name.split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase()
        : '?';

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      splashColor: AppColors.white.withValues(alpha: 0.1),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isTop3
              ? _rankColor.withValues(alpha: 0.06)
              : AppColors.cardBg.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isTop3
                ? _rankColor.withValues(alpha: 0.2)
                : AppColors.inputBorder.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          children: [
            // Rank number
            SizedBox(
              width: 32,
              child: Text(
                '#$rank',
                style: TextStyle(
                  color: _rankColor,
                  fontSize: isTop3 ? 18 : 15,
                  fontWeight: isTop3 ? FontWeight.w800 : FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Avatar
            Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: isTop3
                    ? Border.all(color: _rankColor.withValues(alpha: 0.5), width: 2)
                    : null,
              ),
              child: CircleAvatar(
                radius: 20,
                backgroundColor: AppColors.inputFill,
                backgroundImage: avatarUrl != null ? NetworkImage(avatarUrl!) : null,
                child: avatarUrl == null
                    ? Text(initials, style: TextStyle(
                        color: isTop3 ? _rankColor : AppColors.lightOrange,
                        fontSize: 13, fontWeight: FontWeight.w700,
                      ))
                    : null,
              ),
            ),
            const SizedBox(width: 14),
            // Name & subtitle
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: TextStyle(
                    color: AppColors.white, fontSize: 15,
                    fontWeight: isTop3 ? FontWeight.w700 : FontWeight.w600,
                  ), maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 2),
                  Text(subtitle, style: const TextStyle(
                    color: AppColors.hintText, fontSize: 12, fontWeight: FontWeight.w400,
                  )),
                ],
              ),
            ),
            // Value
            Text(value, style: TextStyle(
              color: isTop3 ? _rankColor : AppColors.lightOrange,
              fontSize: 16, fontWeight: FontWeight.w700,
            )),
          ],
        ),
      ),
    );
  }
}
```

## Onboarding Slide

Full-screen slide for PageView-based onboarding flows.

```dart
class OnboardingSlide extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final int currentPage;
  final int totalPages;

  const OnboardingSlide({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    required this.currentPage,
    required this.totalPages,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 36),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Icon hero
          Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.orange.withValues(alpha: 0.1),
              border: Border.all(
                color: AppColors.orange.withValues(alpha: 0.2), width: 2,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.orange.withValues(alpha: 0.2),
                  blurRadius: 40,
                  spreadRadius: 5,
                ),
              ],
            ),
            child: Icon(icon, color: AppColors.orange, size: 52),
          ),
          const SizedBox(height: 48),
          // Title
          Text(title, textAlign: TextAlign.center, style: const TextStyle(
            color: AppColors.white, fontSize: 26, fontWeight: FontWeight.w800,
            letterSpacing: 0.5, height: 1.3,
          )),
          const SizedBox(height: 16),
          // Description
          Text(description, textAlign: TextAlign.center, style: TextStyle(
            color: AppColors.hintText, fontSize: 15, fontWeight: FontWeight.w400,
            height: 1.6,
          )),
          const SizedBox(height: 48),
          // Page indicators
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(totalPages, (i) {
              final isActive = i == currentPage;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeOutCubic,
                width: isActive ? 28 : 8,
                height: 8,
                margin: EdgeInsets.only(right: i < totalPages - 1 ? 8 : 0),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  color: isActive
                      ? AppColors.orange
                      : AppColors.inputBorder.withValues(alpha: 0.5),
                  boxShadow: isActive
                      ? [BoxShadow(
                          color: AppColors.orange.withValues(alpha: 0.4),
                          blurRadius: 8,
                        )]
                      : null,
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}
```

## Media Player Overlay Card

Floating overlay for video/audio playback controls.

```dart
class MediaPlayerOverlay extends StatelessWidget {
  final String title;
  final String channelName;
  final bool isPlaying;
  final double progress; // 0.0–1.0
  final String currentTime;
  final String totalTime;
  final VoidCallback? onPlayPause;
  final VoidCallback? onClose;
  final ValueChanged<double>? onSeek;

  const MediaPlayerOverlay({
    super.key,
    required this.title,
    required this.channelName,
    this.isPlaying = false,
    this.progress = 0.0,
    this.currentTime = '0:00',
    this.totalTime = '0:00',
    this.onPlayPause,
    this.onClose,
    this.onSeek,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.inputBorder.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.5),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: AppColors.orange.withValues(alpha: 0.06),
            blurRadius: 32,
            spreadRadius: 0,
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 12, 0),
            child: Row(
              children: [
                // Now playing info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('NOW PLAYING', style: TextStyle(
                        color: AppColors.orange, fontSize: 10,
                        fontWeight: FontWeight.w700, letterSpacing: 1.5,
                      )),
                      const SizedBox(height: 6),
                      Text(title, style: const TextStyle(
                        color: AppColors.white, fontSize: 16, fontWeight: FontWeight.w700,
                      ), maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Text(channelName, style: const TextStyle(
                        color: AppColors.hintText, fontSize: 13, fontWeight: FontWeight.w400,
                      )),
                    ],
                  ),
                ),
                // Close button
                IconButton(
                  onPressed: onClose,
                  icon: const Icon(Icons.close_rounded, color: AppColors.hintText, size: 22),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Progress bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              children: [
                SliderTheme(
                  data: SliderThemeData(
                    trackHeight: 4,
                    activeTrackColor: AppColors.orange,
                    inactiveTrackColor: AppColors.inputBorder.withValues(alpha: 0.4),
                    thumbColor: AppColors.orange,
                    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                    overlayColor: AppColors.orange.withValues(alpha: 0.2),
                    overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
                  ),
                  child: Slider(
                    value: progress.clamp(0.0, 1.0),
                    onChanged: onSeek,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(currentTime, style: TextStyle(
                        color: AppColors.hintText, fontSize: 11, fontWeight: FontWeight.w500,
                      )),
                      Text(totalTime, style: TextStyle(
                        color: AppColors.hintText, fontSize: 11, fontWeight: FontWeight.w500,
                      )),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Controls row
          Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  onPressed: () {},
                  icon: const Icon(Icons.skip_previous_rounded,
                      color: AppColors.white, size: 28),
                ),
                const SizedBox(width: 16),
                // Play/Pause button
                Container(
                  decoration: BoxDecoration(
                    gradient: AppColors.buttonGradient,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.orange.withValues(alpha: 0.35),
                        blurRadius: 16,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: IconButton(
                    onPressed: onPlayPause,
                    icon: Icon(
                      isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                      color: AppColors.darkBlue, size: 32,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                IconButton(
                  onPressed: () {},
                  icon: const Icon(Icons.skip_next_rounded,
                      color: AppColors.white, size: 28),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

## Achievement / Milestone Card

Celebratory card for milestones, unlocked achievements, rewards.

```dart
class AchievementCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final bool isUnlocked;
  final double? progress; // 0.0–1.0 for partial progress, null if N/A

  const AchievementCard({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    this.isUnlocked = false,
    this.progress,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = isUnlocked ? AppColors.orange : AppColors.hintText;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isUnlocked
              ? AppColors.orange.withValues(alpha: 0.3)
              : AppColors.inputBorder.withValues(alpha: 0.2),
        ),
        boxShadow: isUnlocked
            ? [
                BoxShadow(
                  color: AppColors.orange.withValues(alpha: 0.1),
                  blurRadius: 20,
                  spreadRadius: 0,
                ),
              ]
            : null,
      ),
      child: Row(
        children: [
          // Icon
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: isUnlocked ? 0.15 : 0.08),
              borderRadius: BorderRadius.circular(14),
              border: isUnlocked
                  ? Border.all(color: AppColors.orange.withValues(alpha: 0.3))
                  : null,
            ),
            child: Icon(icon, color: accentColor, size: 26),
          ),
          const SizedBox(width: 16),
          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(
                  color: isUnlocked ? AppColors.white : AppColors.hintText,
                  fontSize: 15, fontWeight: FontWeight.w700,
                )),
                const SizedBox(height: 4),
                Text(description, style: TextStyle(
                  color: AppColors.hintText.withValues(alpha: isUnlocked ? 1.0 : 0.6),
                  fontSize: 13, fontWeight: FontWeight.w400,
                )),
                if (progress != null && !isUnlocked) ...[
                  const SizedBox(height: 10),
                  // Progress bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      value: progress!.clamp(0.0, 1.0),
                      minHeight: 4,
                      backgroundColor: AppColors.inputBorder.withValues(alpha: 0.3),
                      valueColor: AlwaysStoppedAnimation<Color>(AppColors.orange),
                    ),
                  ),
                ],
              ],
            ),
          ),
          // Check or lock
          const SizedBox(width: 12),
          Icon(
            isUnlocked ? Icons.check_circle_rounded : Icons.lock_rounded,
            color: accentColor.withValues(alpha: isUnlocked ? 1.0 : 0.4),
            size: 22,
          ),
        ],
      ),
    );
  }
}
```
