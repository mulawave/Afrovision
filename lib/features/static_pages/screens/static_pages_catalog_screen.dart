import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../static_pages_registry.dart';

class StaticPagesCatalogScreen extends StatelessWidget {
  const StaticPagesCatalogScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(context),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.inputFill,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.inputBorder),
                      ),
                      child: const Text(
                        'Open AfroVision legal and static pages in an in-app webview. If a page fails in-app, external browser fallback is available on the destination screen.',
                        style: TextStyle(
                          color: AppColors.goldText,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          height: 1.45,
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'In-App Pages',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ...StaticPagesRegistry.inAppEntries.map((entry) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: GestureDetector(
                          onTap: () =>
                              Navigator.pushNamed(context, entry.route),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.inputFill,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: AppColors.inputBorder.withValues(
                                  alpha: 0.8,
                                ),
                              ),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 34,
                                  height: 34,
                                  decoration: BoxDecoration(
                                    color: AppColors.orange.withValues(
                                      alpha: 0.14,
                                    ),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(
                                    Icons.article_rounded,
                                    color: AppColors.orange,
                                    size: 18,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        entry.title,
                                        style: const TextStyle(
                                          color: AppColors.white,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        entry.summary,
                                        style: TextStyle(
                                          color: AppColors.white.withValues(
                                            alpha: 0.68,
                                          ),
                                          fontSize: 11,
                                          height: 1.35,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                const Icon(
                                  Icons.chevron_right_rounded,
                                  color: AppColors.goldText,
                                  size: 20,
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                    const SizedBox(height: 8),
                    const Text(
                      'Web-Only Pages',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ...StaticPagesRegistry.webOnlyEntries.map((entry) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: GestureDetector(
                          onTap: () =>
                              Navigator.pushNamed(context, entry.route),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.inputFill,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: AppColors.lightOrange.withValues(
                                  alpha: 0.55,
                                ),
                              ),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 34,
                                  height: 34,
                                  decoration: BoxDecoration(
                                    color: AppColors.lightOrange.withValues(
                                      alpha: 0.15,
                                    ),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(
                                    Icons.open_in_new_rounded,
                                    color: AppColors.lightOrange,
                                    size: 18,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        entry.title,
                                        style: const TextStyle(
                                          color: AppColors.white,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        '${entry.summary} Opens in external browser.',
                                        style: TextStyle(
                                          color: AppColors.white.withValues(
                                            alpha: 0.68,
                                          ),
                                          fontSize: 11,
                                          height: 1.35,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                const Icon(
                                  Icons.chevron_right_rounded,
                                  color: AppColors.goldText,
                                  size: 20,
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.inputFill,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.inputBorder),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: AppColors.white,
                size: 18,
              ),
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Legal & Static Pages',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
