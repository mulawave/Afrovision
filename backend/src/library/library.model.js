/**
 * Library Model Definitions
 * Firestore schema definitions for Exclusive Channel Library feature
 *
 * Collections:
 * - channel_library_items (readable content)
 * - channel_library_series (grouped content)
 * - library_reader_progress (user reading state)
 * - library_bookmarks (user bookmarks with notes)
 * - user_favorite_library_items (user favorites)
 * - library_engagement_events (analytics and tracking)
 */

/**
 * channel_library_items
 * Readable content (books, comics, magazines) owned by channels
 */
const CHANNEL_LIBRARY_ITEMS_SCHEMA = {
  id: 'string',
  channelId: 'string', // reference to channels.id
  seriesId: 'string|null', // optional: reference to channel_library_series.id
  seriesOrderIndex: 'number', // order within series, 0-indexed
  contentType: 'enum', // book|comic|magazine|other
  title: 'string',
  subtitle: 'string|null',
  author: 'string',
  description: 'string',
  tags: 'string[]',
  coverAssetUrl: 'string', // signed URL or GCS reference
  readerAssetManifestUrl: 'string', // stored path to manifest JSON
  totalPages: 'number',
  estimatedReadMinutes: 'number',
  status: 'enum', // draft|published|archived
  publishedAt: 'timestamp|null',
  createdBy: 'string', // userId of uploader
  updatedBy: 'string', // userId of last editor
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
  // Engagement counters (denormalized, updated by jobs)
  totalReads: 'number', // count of distinct users who opened
  totalFavorites: 'number', // count of current favorites
  avgReadingDuration: 'number', // minutes
  completionRate: 'number', // percentage of readers who finished
};

/**
 * channel_library_series
 * Grouped collections (e.g., "Book Series: The Chronicles")
 */
const CHANNEL_LIBRARY_SERIES_SCHEMA = {
  id: 'string',
  channelId: 'string', // reference to channels.id
  title: 'string',
  description: 'string|null',
  coverAssetUrl: 'string|null',
  sortIndex: 'number', // order of series display, asc
  status: 'enum', // active|archived
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
};

/**
 * library_reader_progress
 * User reading state: which spread/page user is on, when last read
 */
const LIBRARY_READER_PROGRESS_SCHEMA = {
  id: 'string',
  userId: 'string',
  channelId: 'string',
  itemId: 'string', // reference to channel_library_items.id
  currentSpreadIndex: 'number', // 0-indexed spread number
  currentPageLeft: 'number|null', // for single-page spreads
  currentPageRight: 'number|null', // for two-page spreads
  isCompleted: 'boolean', // true when user reached final page
  lastReadAt: 'timestamp',
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
};

/**
 * library_bookmarks
 * User-created bookmarks with optional notes
 */
const LIBRARY_BOOKMARKS_SCHEMA = {
  id: 'string',
  userId: 'string',
  channelId: 'string',
  itemId: 'string', // reference to channel_library_items.id
  spreadIndex: 'number', // which spread bookmarked
  page: 'number|null', // optional page reference
  note: 'string|null', // user's optional bookmark note
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
};

/**
 * user_favorite_library_items
 * User's favorite content (scoped by entitlement on retrieval)
 */
const USER_FAVORITE_LIBRARY_ITEMS_SCHEMA = {
  id: 'string',
  userId: 'string',
  channelId: 'string',
  itemId: 'string', // reference to channel_library_items.id
  addedAt: 'timestamp', // when favorited
  createdAt: 'timestamp',
  // Note: No expiry/TTL field; filtering by entitlement happens at retrieval time
};

/**
 * library_engagement_events
 * Analytics: user interactions with library content
 */
const LIBRARY_ENGAGEMENT_EVENTS_SCHEMA = {
  id: 'string',
  userId: 'string',
  channelId: 'string',
  itemId: 'string|null', // nullable for discovery events
  eventType: 'enum', // item-opened, modal-next, favorite-added, favorite-removed,
  // read-start, read-finish, auto-next-series, bookmark-created,
  // resume-used, recommendation-click, series-completed
  metadata: 'object', // event-specific data
  timestamp: 'timestamp',
};

/**
 * Reader Asset Manifest Structure
 * Stored as JSON file, referenced by channel_library_items.readerAssetManifestUrl
 */
const READER_ASSET_MANIFEST_STRUCTURE = {
  itemId: 'string',
  version: 'number', // 1
  pages: [
    {
      pageNumber: 'number',
      imageUrl: 'string', // signed GCS URL
      width: 'number',
      height: 'number',
    },
  ],
  spreads: [
    {
      spreadIndex: 'number',
      leftPageNumber: 'number|null',
      rightPageNumber: 'number|null',
      animationDuration: 'number', // ms for page flip
    },
  ],
  metadata: {
    totalPages: 'number',
    totalSpreads: 'number',
    bindingType: 'string', // left-to-right|right-to-left
  },
};

/**
 * Firestore Collection Paths
 */
const COLLECTION_PATHS = {
  LIBRARY_ITEMS: 'channel_library_items',
  LIBRARY_SERIES: 'channel_library_series',
  READER_PROGRESS: 'library_reader_progress',
  BOOKMARKS: 'library_bookmarks',
  FAVORITE_ITEMS: 'user_favorite_library_items',
  ENGAGEMENT_EVENTS: 'library_engagement_events',
};

/**
 * Document ID Generation Helpers
 */
const DocumentHelpers = {
  /**
   * Generate library item ID
   * Format: li_{timestamp}_{randomSuffix}
   */
  generateItemId: () => {
    const timestamp = Date.now();
    const suffix = Math.random().toString(36).substring(2, 8);
    return `li_${timestamp}_${suffix}`;
  },

  /**
   * Generate series ID
   */
  generateSeriesId: () => {
    const timestamp = Date.now();
    const suffix = Math.random().toString(36).substring(2, 8);
    return `ls_${timestamp}_${suffix}`;
  },

  /**
   * Generate progress document ID
   * Format: lp_{userId}_{channelId}_{itemId}
   */
  generateProgressId: (userId, channelId, itemId) => {
    return `lp_${userId}_${channelId}_${itemId}`;
  },

  /**
   * Generate bookmark ID
   */
  generateBookmarkId: () => {
    const timestamp = Date.now();
    const suffix = Math.random().toString(36).substring(2, 8);
    return `lb_${timestamp}_${suffix}`;
  },

  /**
   * Generate favorite ID
   * Format: fav_{userId}_{channelId}_{itemId}
   */
  generateFavoriteId: (userId, channelId, itemId) => {
    return `fav_${userId}_${channelId}_${itemId}`;
  },

  /**
   * Generate engagement event ID
   */
  generateEventId: () => {
    const timestamp = Date.now();
    const suffix = Math.random().toString(36).substring(2, 8);
    return `evt_${timestamp}_${suffix}`;
  },
};

/**
 * Validation Rules
 */
const ValidationRules = {
  contentTypes: ['book', 'comic', 'magazine', 'other'],
  itemStatus: ['draft', 'published', 'archived'],
  seriesStatus: ['active', 'archived'],
  eventTypes: [
    'item-opened',
    'modal-next',
    'favorite-added',
    'favorite-removed',
    'read-start',
    'read-finish',
    'auto-next-series',
    'bookmark-created',
    'resume-used',
    'recommendation-click',
    'series-completed',
  ],
  bindingTypes: ['left-to-right', 'right-to-left'],

  /**
   * Validate library item creation payload
   */
  validateItemPayload: (payload) => {
    const errors = [];
    if (!payload.title || payload.title.trim().length === 0)
      errors.push('title is required and non-empty');
    if (!payload.author || payload.author.trim().length === 0)
      errors.push('author is required');
    if (!payload.contentType || !ValidationRules.contentTypes.includes(payload.contentType))
      errors.push(`contentType must be one of: ${ValidationRules.contentTypes.join(', ')}`);
    if (!payload.totalPages || payload.totalPages < 1)
      errors.push('totalPages must be >= 1');
    if (payload.seriesId && !payload.seriesOrderIndex && payload.seriesOrderIndex !== 0)
      errors.push('seriesOrderIndex is required when seriesId is provided');
    return { valid: errors.length === 0, errors };
  },

  /**
   * Validate series creation payload
   */
  validateSeriesPayload: (payload) => {
    const errors = [];
    if (!payload.title || payload.title.trim().length === 0)
      errors.push('title is required and non-empty');
    return { valid: errors.length === 0, errors };
  },

  /**
   * Validate progress update
   */
  validateProgressPayload: (payload) => {
    const errors = [];
    if (typeof payload.currentSpreadIndex !== 'number' || payload.currentSpreadIndex < 0)
      errors.push('currentSpreadIndex must be a non-negative number');
    return { valid: errors.length === 0, errors };
  },
};

module.exports = {
  CHANNEL_LIBRARY_ITEMS_SCHEMA,
  CHANNEL_LIBRARY_SERIES_SCHEMA,
  LIBRARY_READER_PROGRESS_SCHEMA,
  LIBRARY_BOOKMARKS_SCHEMA,
  USER_FAVORITE_LIBRARY_ITEMS_SCHEMA,
  LIBRARY_ENGAGEMENT_EVENTS_SCHEMA,
  READER_ASSET_MANIFEST_STRUCTURE,
  COLLECTION_PATHS,
  DocumentHelpers,
  ValidationRules,
};
