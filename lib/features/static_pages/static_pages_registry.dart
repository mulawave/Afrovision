class StaticPageEntry {
  final String route;
  final String title;
  final String summary;
  final String path;

  const StaticPageEntry({
    required this.route,
    required this.title,
    required this.summary,
    required this.path,
  });
}

class StaticPagesRegistry {
  static const String websiteBaseUrl = 'https://www.afrovision.com';

  static const List<StaticPageEntry> inAppEntries = [
    StaticPageEntry(
      route: '/about',
      title: 'About',
      summary: 'Company overview, mission, and story.',
      path: '/about',
    ),
    StaticPageEntry(
      route: '/contact',
      title: 'Contact',
      summary: 'Support and contact channels.',
      path: '/contact',
    ),
    StaticPageEntry(
      route: '/cookies',
      title: 'Cookies',
      summary: 'Cookie usage and controls.',
      path: '/cookies',
    ),
    StaticPageEntry(
      route: '/copyright',
      title: 'Copyright',
      summary: 'Copyright notices and ownership.',
      path: '/copyright',
    ),
    StaticPageEntry(
      route: '/download',
      title: 'Download',
      summary: 'Platform app and client downloads.',
      path: '/download',
    ),
    StaticPageEntry(
      route: '/pricing',
      title: 'Pricing',
      summary: 'Plans and pricing information.',
      path: '/pricing',
    ),
    StaticPageEntry(
      route: '/refund',
      title: 'Refund Policy',
      summary: 'Refund eligibility and policy terms.',
      path: '/refund',
    ),
    StaticPageEntry(
      route: '/report-copyright',
      title: 'Report Copyright',
      summary: 'Report copyright concerns or claims.',
      path: '/report-copyright',
    ),
    StaticPageEntry(
      route: '/updates',
      title: 'Updates',
      summary: 'Product and platform update notes.',
      path: '/updates',
    ),
    StaticPageEntry(
      route: '/aml',
      title: 'AML Policy',
      summary: 'Anti-money-laundering policy details.',
      path: '/aml',
    ),
    StaticPageEntry(
      route: '/community-rules',
      title: 'Community Rules',
      summary: 'Conduct standards for chat, streams, and comments.',
      path: '/community-rules',
    ),
    StaticPageEntry(
      route: '/exclusive-channel-policy',
      title: 'Exclusive Channel Policy',
      summary: 'How exclusive channel membership and access work.',
      path: '/exclusive-channel-policy',
    ),
    StaticPageEntry(
      route: '/creator-agreement',
      title: 'Creator Agreement',
      summary: 'Creator eligibility, licensing, and payout terms.',
      path: '/creator-agreement',
    ),
    StaticPageEntry(
      route: '/advertising-guidelines',
      title: 'Advertising Guidelines',
      summary: 'Accepted ad content and campaign review process.',
      path: '/advertising-guidelines',
    ),
    StaticPageEntry(
      route: '/licenses-attributions',
      title: 'Licences & Attributions',
      summary: 'Open-source software used across AfroVision apps.',
      path: '/licenses-attributions',
    ),
  ];

  static const List<StaticPageEntry> webOnlyEntries = [
    StaticPageEntry(
      route: '/careers',
      title: 'Careers',
      summary: 'Jobs and career opportunities at AfroVision.',
      path: '/careers',
    ),
    StaticPageEntry(
      route: '/press',
      title: 'Press',
      summary: 'Press resources, announcements, and media contacts.',
      path: '/press',
    ),
  ];

  static StaticPageEntry? entryForRoute(String route) {
    for (final entry in inAppEntries) {
      if (entry.route == route) {
        return entry;
      }
    }
    return null;
  }

  static StaticPageEntry? webOnlyEntryForRoute(String route) {
    for (final entry in webOnlyEntries) {
      if (entry.route == route) {
        return entry;
      }
    }
    return null;
  }

  static Uri uriForEntry(StaticPageEntry entry) {
    return Uri.parse('$websiteBaseUrl${entry.path}');
  }
}
