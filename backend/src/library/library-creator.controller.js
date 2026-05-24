/**
 * Library Creator Controller
 * Handles creator/admin operations: create items, series, manage content lifecycle
 *
 * All endpoints require:
 * - Authentication
 * - Authorization (channel owner or admin)
 * - Request validation
 */

const LibraryService = require('./library.service');
const LibraryPolicyService = require('./library-policy.service');
const { generateSignedUploadUrl } = require('../utils/gcs');
const admin = require('firebase-admin');
const { PDFDocument } = require('pdf-lib');
const crypto = require('crypto');
const path = require('path');

const libraryService = new LibraryService();
const policyService = new LibraryPolicyService();

const ALLOWED_LIBRARY_ASSET_TYPES = {
  cover: new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ]),
  reader_pdf: new Set([
    'application/pdf',
  ]),
  reader_page: new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]),
  manifest: new Set([
    'application/json',
    'text/json',
  ]),
};

const LIBRARY_ASSET_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/json': '.json',
  'text/json': '.json',
};

async function fetchBufferFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch asset: ${response.status}`);
  }
  const arr = await response.arrayBuffer();
  return Buffer.from(arr);
}

async function getPdfPageCountFromUrl(pdfUrl) {
  const bytes = await fetchBufferFromUrl(pdfUrl);
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

async function buildPdfFromImageUrls(imageUrls) {
  const pdf = await PDFDocument.create();

  for (const imageUrl of imageUrls) {
    const imageBytes = await fetchBufferFromUrl(imageUrl);
    const lower = String(imageUrl).toLowerCase();
    let embedded;

    if (lower.includes('.png')) {
      embedded = await pdf.embedPng(imageBytes);
    } else {
      embedded = await pdf.embedJpg(imageBytes);
    }

    const { width, height } = embedded;
    const page = pdf.addPage([width, height]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  return Buffer.from(await pdf.save());
}

function buildSpreadManifest(pageCount, pageImageUrls = []) {
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pages.push({
      pageNumber,
      imageUrl: pageImageUrls[pageNumber - 1] || null,
    });
  }

  const spreads = [];
  let spreadIndex = 0;
  if (pageCount > 0) {
    spreads.push({
      spreadIndex,
      leftPageNumber: null,
      rightPageNumber: 1,
    });
    spreadIndex += 1;
  }

  for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 2) {
    spreads.push({
      spreadIndex,
      leftPageNumber: pageNumber,
      rightPageNumber: pageNumber + 1 <= pageCount ? pageNumber + 1 : null,
    });
    spreadIndex += 1;
  }

  return { pages, spreads };
}

/**
 * Create signed upload URL for library assets.
 * POST /creator/channels/:channelId/library/upload-url
 */
exports.createAssetUploadUrl = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;
    const { asset_type, content_type, file_name } = req.body || {};

    const canManage = await policyService.canManageLibrary(userId, channelId);
    if (!canManage) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to manage this channel library',
      });
    }

    if (!asset_type || !['cover', 'manifest', 'reader_pdf', 'reader_page'].includes(asset_type)) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'asset_type must be one of: cover, manifest, reader_pdf, reader_page',
      });
    }

    if (!content_type || typeof content_type !== 'string') {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'content_type is required',
      });
    }

    if (!ALLOWED_LIBRARY_ASSET_TYPES[asset_type].has(content_type)) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: `Unsupported content_type for ${asset_type}`,
      });
    }

    const providedExt = path.extname(String(file_name || '')).toLowerCase();
    const mappedExt = LIBRARY_ASSET_EXTENSIONS[content_type] || '';
    const ext = providedExt || mappedExt || (asset_type === 'manifest' ? '.json' : '.bin');
    let folder = 'library/assets';
    if (asset_type === 'cover') folder = 'library/covers';
    if (asset_type === 'manifest') folder = 'library/manifests';
    if (asset_type === 'reader_pdf') folder = 'library/books';
    if (asset_type === 'reader_page') folder = 'library/page-images';
    const filename = `${folder}/${channelId}/${crypto.randomUUID()}${ext}`;

    const { signedUrl, publicUrl } = await generateSignedUploadUrl(filename, content_type, 30);

    return res.status(200).json({
      success: true,
      signed_url: signedUrl,
      public_url: publicUrl,
      filename,
    });
  } catch (error) {
    console.error('Error creating library asset upload URL:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Generate reader manifest automatically from a PDF or uploaded page images.
 * POST /creator/channels/:channelId/library/reader-assets/manifest
 */
exports.generateReaderManifest = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;
    const { pdf_url, page_image_urls } = req.body || {};

    const canManage = await policyService.canManageLibrary(userId, channelId);
    if (!canManage) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to manage this channel library',
      });
    }

    const pageImageUrls = Array.isArray(page_image_urls)
      ? page_image_urls.filter((url) => typeof url === 'string' && url.trim().length > 0)
      : [];

    if ((!pdf_url || typeof pdf_url !== 'string') && pageImageUrls.length === 0) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'Provide pdf_url or at least one page_image_urls entry',
      });
    }

    const bucket = admin.storage().bucket();
    let resolvedPdfUrl = typeof pdf_url === 'string' && pdf_url.trim().length > 0 ? pdf_url.trim() : null;
    let totalPages = 0;

    if (!resolvedPdfUrl && pageImageUrls.length > 0) {
      const pdfBuffer = await buildPdfFromImageUrls(pageImageUrls);
      const pdfFilename = `library/books/${channelId}/${crypto.randomUUID()}.pdf`;
      const pdfFile = bucket.file(pdfFilename);
      await pdfFile.save(pdfBuffer, {
        contentType: 'application/pdf',
        resumable: false,
      });
      resolvedPdfUrl = `https://storage.googleapis.com/${bucket.name}/${pdfFilename}`;
    }

    if (resolvedPdfUrl) {
      totalPages = await getPdfPageCountFromUrl(resolvedPdfUrl);
    }
    if (!Number.isFinite(totalPages) || totalPages <= 0) {
      totalPages = pageImageUrls.length;
    }

    const spreadManifest = buildSpreadManifest(totalPages, pageImageUrls);
    const manifest = {
      version: 2,
      sourceType: resolvedPdfUrl ? 'pdf' : 'images',
      pdfUrl: resolvedPdfUrl,
      pageImageUrls,
      totalPages,
      pages: spreadManifest.pages,
      spreads: spreadManifest.spreads,
    };

    const manifestFilename = `library/manifests/${channelId}/${crypto.randomUUID()}.json`;
    const manifestFile = bucket.file(manifestFilename);
    await manifestFile.save(JSON.stringify(manifest), {
      contentType: 'application/json',
      resumable: false,
    });

    return res.status(200).json({
      success: true,
      manifest_url: `https://storage.googleapis.com/${bucket.name}/${manifestFilename}`,
      pdf_url: resolvedPdfUrl,
      total_pages: totalPages,
    });
  } catch (error) {
    console.error('Error generating library reader manifest:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Create library series
 * POST /creator/channels/:channelId/library/series
 */
exports.createSeries = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    // Authorization check
    const canManage = await policyService.canManageLibrary(userId, channelId);
    if (!canManage) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to manage this channel library',
      });
    }

    const { title, description, coverAssetUrl } = req.body;

    // Validate payload
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'title is required and must be non-empty string',
      });
    }

    const series = await libraryService.createLibrarySeries(
      channelId,
      { title, description, coverAssetUrl },
      userId
    );

    return res.status(201).json({
      success: true,
      data: series,
    });
  } catch (error) {
    console.error('Error creating library series:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Update library series
 * PATCH /creator/channels/:channelId/library/series/:seriesId
 */
exports.updateSeries = async (req, res) => {
  try {
    const { channelId, seriesId } = req.params;
    const userId = req.userId;

    // Authorization check
    const canManage = await policyService.canManageLibrary(userId, channelId);
    if (!canManage) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to manage this channel library',
      });
    }

    const updates = {
      title: req.body.title,
      description: req.body.description,
      coverAssetUrl: req.body.coverAssetUrl,
      sortIndex: req.body.sortIndex,
      status: req.body.status,
    };

    // Remove undefined fields
    Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);

    const series = await libraryService.updateLibrarySeries(channelId, seriesId, updates, userId);

    return res.status(200).json({
      success: true,
      data: series,
    });
  } catch (error) {
    console.error('Error updating library series:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Create library item
 * POST /creator/channels/:channelId/library/items
 */
exports.createItem = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    // Authorization check
    const canManage = await policyService.canManageLibrary(userId, channelId);
    if (!canManage) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to manage this channel library',
      });
    }

    const payload = {
      title: req.body.title,
      subtitle: req.body.subtitle,
      author: req.body.author,
      description: req.body.description,
      tags: req.body.tags,
      contentType: req.body.contentType,
      totalPages: req.body.totalPages,
      estimatedReadMinutes: req.body.estimatedReadMinutes,
      coverAssetUrl: req.body.coverAssetUrl,
      readerAssetManifestUrl: req.body.readerAssetManifestUrl,
      seriesId: req.body.seriesId,
      seriesOrderIndex: req.body.seriesOrderIndex,
      status: req.body.status || 'draft',
    };

    const item = await libraryService.createLibraryItem(channelId, payload, userId);

    return res.status(201).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('Error creating library item:', error);
    return res.status(500).json({
      error: 'Invalid payload',
      message: error.message,
    });
  }
};

/**
 * Update library item metadata
 * PATCH /creator/channels/:channelId/library/items/:itemId
 */
exports.updateItem = async (req, res) => {
  try {
    const { channelId, itemId } = req.params;
    const userId = req.userId;

    // Authorization check
    const canManage = await policyService.canManageLibrary(userId, channelId);
    if (!canManage) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to manage this channel library',
      });
    }

    const updates = {
      title: req.body.title,
      subtitle: req.body.subtitle,
      author: req.body.author,
      description: req.body.description,
      tags: req.body.tags,
      estimatedReadMinutes: req.body.estimatedReadMinutes,
    };

    // Remove undefined fields
    Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);

    const item = await libraryService.updateLibraryItem(channelId, itemId, updates, userId);

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('Error updating library item:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Publish library item
 * POST /creator/channels/:channelId/library/items/:itemId/publish
 */
exports.publishItem = async (req, res) => {
  try {
    const { channelId, itemId } = req.params;
    const userId = req.userId;

    // Authorization check
    const canPublish = await policyService.canPublishLibraryItems(userId, channelId);
    if (!canPublish) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to publish items in this channel',
      });
    }

    const item = await libraryService.publishLibraryItem(channelId, itemId, userId);

    return res.status(200).json({
      success: true,
      data: item,
      message: 'Item published successfully',
    });
  } catch (error) {
    console.error('Error publishing library item:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Archive library item
 * POST /creator/channels/:channelId/library/items/:itemId/archive
 */
exports.archiveItem = async (req, res) => {
  try {
    const { channelId, itemId } = req.params;
    const userId = req.userId;

    // Authorization check
    const canPublish = await policyService.canPublishLibraryItems(userId, channelId);
    if (!canPublish) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to manage items in this channel',
      });
    }

    const item = await libraryService.archiveLibraryItem(channelId, itemId, userId);

    return res.status(200).json({
      success: true,
      data: item,
      message: 'Item archived successfully',
    });
  } catch (error) {
    console.error('Error archiving library item:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Delete library item
 * DELETE /creator/channels/:channelId/library/items/:itemId
 */
exports.deleteItem = async (req, res) => {
  try {
    const { channelId, itemId } = req.params;
    const userId = req.userId;

    // Authorization check
    const canPublish = await policyService.canPublishLibraryItems(userId, channelId);
    if (!canPublish) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to delete items in this channel',
      });
    }

    await libraryService.deleteLibraryItem(channelId, itemId, userId);

    return res.status(200).json({
      success: true,
      message: 'Item deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting library item:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Reorder library items and series
 * PATCH /creator/channels/:channelId/library/order
 * Expects: { items: [{ itemId, seriesOrderIndex }], series: [{ seriesId, sortIndex }] }
 */
exports.reorderContent = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    // Authorization check
    const canManage = await policyService.canManageLibrary(userId, channelId);
    if (!canManage) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to manage this channel library',
      });
    }

    const { items, series } = req.body;

    // Reorder items
    if (Array.isArray(items)) {
      for (const { itemId, seriesOrderIndex } of items) {
        await libraryService.updateLibraryItem(
          channelId,
          itemId,
          { seriesOrderIndex },
          userId
        );
      }
    }

    // Reorder series
    if (Array.isArray(series)) {
      for (const { seriesId, sortIndex } of series) {
        await libraryService.updateLibrarySeries(
          channelId,
          seriesId,
          { sortIndex },
          userId
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Content reordered successfully',
    });
  } catch (error) {
    console.error('Error reordering library content:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get library metrics for channel
 * GET /creator/channels/:channelId/library/metrics
 */
exports.getMetrics = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    // Authorization check
    const canManage = await policyService.canManageLibrary(userId, channelId);
    if (!canManage) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to view metrics for this channel',
      });
    }

    const admin = require('firebase-admin');
    const db = admin.firestore();

    // Get all items for channel
    const itemsSnap = await db
      .collection('channel_library_items')
      .where('channelId', '==', channelId)
      .where('status', '==', 'published')
      .get();

    let totalReads = 0;
    let totalFavorites = 0;
    let totalCompleted = 0;
    let avgCompletionRate = 0;

    itemsSnap.docs.forEach((doc) => {
      const data = doc.data();
      totalReads += data.totalReads || 0;
      totalFavorites += data.totalFavorites || 0;
      totalCompleted += data.completionRate || 0;
    });

    const itemCount = itemsSnap.size;
    avgCompletionRate = itemCount > 0 ? totalCompleted / itemCount : 0;

    return res.status(200).json({
      success: true,
      data: {
        itemCount,
        totalReads,
        totalFavorites,
        avgCompletionRate: Math.round(avgCompletionRate * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error getting library metrics:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * List creator series for a channel
 * GET /creator/channels/:channelId/library/series
 */
exports.listSeries = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    const canManage = await policyService.canManageLibrary(userId, channelId);
    if (!canManage) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to manage this channel library',
      });
    }

    const series = await libraryService.listCreatorSeries(channelId);

    return res.status(200).json({
      success: true,
      data: series,
    });
  } catch (error) {
    console.error('Error listing creator series:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * List creator items for a channel
 * GET /creator/channels/:channelId/library/items
 */
exports.listItems = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    const canManage = await policyService.canManageLibrary(userId, channelId);
    if (!canManage) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to manage this channel library',
      });
    }

    const items = await libraryService.listCreatorItems(channelId);

    return res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('Error listing creator items:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};
