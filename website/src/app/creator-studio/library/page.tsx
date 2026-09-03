"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  archiveCreatorChannelLibraryItemApi,
  Channel,
  generateCreatorLibraryReaderManifestApi,
  createCreatorChannelLibraryItemApi,
  updateCreatorChannelLibraryItemApi,
  createCreatorChannelLibrarySeriesApi,
  deleteCreatorChannelLibraryItemApi,
  getCreatorChannelLibraryItemsApi,
  getCreatorChannelLibrarySeriesApi,
  getMyChannelsApi,
  LibraryItem,
  LibrarySeries,
  publishCreatorChannelLibraryItemApi,
  reorderCreatorChannelLibraryContentApi,
  uploadCreatorLibraryAssetApi,
} from "@/lib/api";

/**
 * Convert every page of a PDF into JPEG image files, entirely in the browser.
 * The PDF itself is never uploaded or stored — library content is strictly
 * non-downloadable and is always served to the reader as page images.
 */
async function convertPdfToPageImages(
  file: File,
  onProgress: (percent: number) => void,
): Promise<File[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const total = pdf.numPages;
  if (total <= 0) {
    throw new Error("PDF contains no pages");
  }

  const MAX_DIMENSION = 2000;
  const images: File[] = [];

  for (let pageNum = 1; pageNum <= total; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(3, Math.max(1, MAX_DIMENSION / Math.max(baseViewport.width, baseViewport.height)));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context unavailable");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: context, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.88);
    });
    page.cleanup();
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) {
      throw new Error(`Failed to render page ${pageNum} of the PDF`);
    }

    const pageIndex = String(pageNum).padStart(4, "0");
    images.push(new File([blob], `page-${pageIndex}.jpg`, { type: "image/jpeg" }));
    onProgress(Math.round((pageNum / total) * 100));
  }

  return images;
}

type ContentType = "book" | "comic" | "magazine" | "other";
type ItemStatus = "all" | "draft" | "published" | "archived";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(size >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

function Spinner({ size = "sm" }: { size?: "sm" | "xs" }) {
  const cls = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <svg className={`animate-spin ${cls}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function CreatorStudioLibraryPage() {
  const [loading, setLoading] = useState(true);
  const [savingSeries, setSavingSeries] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishingNewItem, setPublishingNewItem] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [busySeriesId, setBusySeriesId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // "Add to Series" modal state
  const [addToSeriesItem, setAddToSeriesItem] = useState<LibraryItem | null>(null);
  const [addToSeriesTargetId, setAddToSeriesTargetId] = useState("");
  const [addingToSeries, setAddingToSeries] = useState(false);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [series, setSeries] = useState<LibrarySeries[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsTotalPages, setItemsTotalPages] = useState(1);
  const [itemsTotal, setItemsTotal] = useState(0);
  const itemsLimit = 12;
  const [statusFilter, setStatusFilter] = useState<ItemStatus>("all");

  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesDescription, setSeriesDescription] = useState("");

  const [itemTitle, setItemTitle] = useState("");
  const [itemAuthor, setItemAuthor] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemType, setItemType] = useState<ContentType>("book");
  const [itemPages, setItemPages] = useState("20");
  const [itemManifestUrl, setItemManifestUrl] = useState("");
  const [itemReaderPdfUrl, setItemReaderPdfUrl] = useState("");
  const [itemCoverUrl, setItemCoverUrl] = useState("");
  const [itemSeriesId, setItemSeriesId] = useState("");
  const [itemPdfFileName, setItemPdfFileName] = useState<string | null>(null);
  const [itemPdfFileSize, setItemPdfFileSize] = useState<number>(0);
  const [readerPageImages, setReaderPageImages] = useState<Array<{ url: string; name: string; size: number }>>([]);
  const [manifestUploadProgress, setManifestUploadProgress] = useState(0);
  const [manifestUploading, setManifestUploading] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [coverUploading, setCoverUploading] = useState(false);

  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const pageImagesInputRef = useRef<HTMLInputElement | null>(null);

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) || null,
    [channels, selectedChannelId],
  );

  const visibleItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const loadChannels = useCallback(async () => {
    const channelsRes = await getMyChannelsApi();
    if (!channelsRes.ok || !("channels" in channelsRes.data)) {
      throw new Error("Failed to load your channels");
    }

    const exclusiveOnly = channelsRes.data.channels.filter(
      (channel) => channel.type === "exclusive",
    );
    setChannels(exclusiveOnly);

    if (exclusiveOnly.length > 0) {
      setSelectedChannelId((current) => current || exclusiveOnly[0].id);
    }
  }, []);

  const loadLibraryData = useCallback(async (channelId: string, page: number = 1) => {
    const [seriesRes, itemsRes] = await Promise.all([
      getCreatorChannelLibrarySeriesApi(channelId),
      getCreatorChannelLibraryItemsApi(channelId, { page, limit: itemsLimit }),
    ]);

    if (!seriesRes.ok || !("success" in seriesRes.data)) {
      throw new Error("Failed to load library series");
    }
    if (!itemsRes.ok || !("success" in itemsRes.data)) {
      throw new Error("Failed to load library items");
    }

    setSeries(seriesRes.data.data);
    setItems(itemsRes.data.data);
    if (itemsRes.data.pagination) {
      setItemsPage(itemsRes.data.pagination.page);
      setItemsTotalPages(itemsRes.data.pagination.totalPages);
      setItemsTotal(itemsRes.data.pagination.total);
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await loadChannels();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [loadChannels]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedChannelId) {
      setSeries([]);
      setItems([]);
      setItemsPage(1);
      setItemsTotalPages(1);
      setItemsTotal(0);
      return;
    }

    const fetchData = async () => {
      try {
        setError(null);
        await loadLibraryData(selectedChannelId, 1);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load channel library");
      }
    };

    void fetchData();
  }, [loadLibraryData, selectedChannelId]);

  const refreshActiveChannel = useCallback(async () => {
    if (!selectedChannelId) return;
    await loadLibraryData(selectedChannelId, itemsPage);
  }, [loadLibraryData, selectedChannelId, itemsPage]);

  const handleItemsPageChange = useCallback(async (newPage: number) => {
    if (!selectedChannelId) return;
    try {
      setError(null);
      await loadLibraryData(selectedChannelId, newPage);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load channel library");
    }
  }, [loadLibraryData, selectedChannelId]);

  const handleCreateSeries = async () => {
    if (!selectedChannelId || !seriesTitle.trim()) return;

    try {
      setSavingSeries(true);
      setError(null);
      const res = await createCreatorChannelLibrarySeriesApi(selectedChannelId, {
        title: seriesTitle.trim(),
        description: seriesDescription.trim() || undefined,
      });

      if (!res.ok) {
        throw new Error("Failed to create series");
      }

      setSeriesTitle("");
      setSeriesDescription("");
      setNotice("Series created successfully");
      await refreshActiveChannel();
    } catch (createError) {
      setError(getApiErrorMessage(createError, "Failed to create series"));
    } finally {
      setSavingSeries(false);
    }
  };

  const uploadLibraryAsset = useCallback(
    async (file: File, assetType: "cover" | "reader_page", onProgress: (value: number) => void) => {
      if (!selectedChannelId) {
        throw new Error("Select a channel first");
      }

      // Direct upload through the backend (browser -> proxy -> backend -> GCS).
      // Same-origin from the browser's perspective; no GCS CORS involvement.
      const res = await uploadCreatorLibraryAssetApi(selectedChannelId, file, assetType, onProgress);
      if (!res.ok || !res.data?.public_url) {
        const detail = res.data?.message || res.data?.error || `status ${res.status}`;
        throw new Error(`Failed to upload ${assetType === "cover" ? "cover image" : "page image"} (${detail})`);
      }
      return res.data.public_url;
    },
    [selectedChannelId],
  );

  const handleReaderPdfSelected = useCallback(
    async (file: File) => {
      try {
        setError(null);
        setManifestUploading(true);
        setManifestUploadProgress(0);

        // Convert the PDF to page images entirely in the browser. The PDF is
        // never uploaded or stored, so library content can never be downloaded.
        setNotice("Converting PDF pages to reader images…");
        const pageFiles = await convertPdfToPageImages(file, (value) => {
          // Conversion occupies the first 30% of the progress bar.
          setManifestUploadProgress(Math.round(value * 0.3));
        });

        setNotice(`Uploading ${pageFiles.length} page image${pageFiles.length === 1 ? "" : "s"}…`);
        const uploadedPages: Array<{ url: string; name: string; size: number }> = [];
        for (let i = 0; i < pageFiles.length; i += 1) {
          const pageFile = pageFiles[i];
          const pageUrl = await uploadLibraryAsset(pageFile, "reader_page", (value) => {
            // Uploads occupy the remaining 70% of the progress bar.
            const base = 30 + (i / pageFiles.length) * 70;
            const scaled = base + (value / 100) * (70 / pageFiles.length);
            setManifestUploadProgress(Math.min(100, Math.round(scaled)));
          });
          uploadedPages.push({ url: pageUrl, name: pageFile.name, size: pageFile.size });
        }

        setReaderPageImages(uploadedPages);
        setItemPdfFileName(file.name);
        setItemPdfFileSize(file.size);

        const manifestRes = await generateCreatorLibraryReaderManifestApi(selectedChannelId, {
          pageImageUrls: uploadedPages.map((page) => page.url),
        });
        if (!manifestRes.ok || !manifestRes.data.manifest_url) {
          throw new Error("Failed to generate reader manifest from PDF pages");
        }
        setItemManifestUrl(manifestRes.data.manifest_url);
        setManifestUploadProgress(100);
        if (manifestRes.data.total_pages > 0) {
          setItemPages(String(manifestRes.data.total_pages));
        }
        setNotice(`PDF converted to ${uploadedPages.length} reader pages and manifest generated`);
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Failed to process PDF");
      } finally {
        setManifestUploading(false);
      }
    },
    [selectedChannelId, uploadLibraryAsset],
  );

  const handleReaderPagesSelected = useCallback(
    async (files: File[]) => {
      if (!selectedChannelId || files.length === 0) return;
      try {
        setError(null);
        setManifestUploading(true);
        setManifestUploadProgress(0);

        const uploadedPages: Array<{ url: string; name: string; size: number }> = [];
        for (let i = 0; i < files.length; i += 1) {
          const file = files[i];
          const pageUrl = await uploadLibraryAsset(file, "reader_page", (value) => {
            const base = (i / files.length) * 100;
            const scaled = base + value / files.length;
            setManifestUploadProgress(Math.min(100, Math.round(scaled)));
          });
          uploadedPages.push({
            url: pageUrl,
            name: file.name,
            size: file.size,
          });
        }

        setReaderPageImages(uploadedPages);
        const manifestRes = await generateCreatorLibraryReaderManifestApi(selectedChannelId, {
          pageImageUrls: uploadedPages.map((page) => page.url),
        });

        if (!manifestRes.ok || !manifestRes.data.manifest_url) {
          throw new Error("Failed to generate manifest from page images");
        }

        setItemManifestUrl(manifestRes.data.manifest_url);
        if (manifestRes.data.pdf_url) {
          setItemReaderPdfUrl(manifestRes.data.pdf_url);
        }
        if (manifestRes.data.total_pages > 0) {
          setItemPages(String(manifestRes.data.total_pages));
        }
        setNotice("Page images uploaded and converted to reader assets");
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Failed to upload page images");
      } finally {
        setManifestUploading(false);
      }
    },
    [selectedChannelId, uploadLibraryAsset],
  );

  const handleCoverSelected = useCallback(
    async (file: File) => {
      try {
        setError(null);
        setCoverUploading(true);
        setCoverUploadProgress(0);

        const coverUrl = await uploadLibraryAsset(file, "cover", (value) => {
          setCoverUploadProgress(value);
        });

        setItemCoverUrl(coverUrl);
        setNotice("Cover image uploaded");
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Failed to upload cover image");
      } finally {
        setCoverUploading(false);
      }
    },
    [uploadLibraryAsset],
  );

  const resetItemForm = () => {
    setItemTitle("");
    setItemAuthor("");
    setItemDescription("");
    setItemPages("20");
    setItemManifestUrl("");
    setItemReaderPdfUrl("");
    setItemCoverUrl("");
    setItemPdfFileName(null);
    setItemPdfFileSize(0);
    setReaderPageImages([]);
    setManifestUploadProgress(0);
    setCoverUploadProgress(0);
    if (coverInputRef.current) coverInputRef.current.value = "";
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    if (pageImagesInputRef.current) pageImagesInputRef.current.value = "";
    setItemSeriesId("");
    setEditingItem(null);
  };

  const handleEditItem = (item: LibraryItem) => {
    setEditingItem(item);
    setItemTitle(item.title ?? "");
    setItemAuthor(item.author ?? "");
    setItemDescription(item.description ?? "");
    setItemType((item.contentType as ContentType) ?? "book");
    setItemPages(String(item.totalPages ?? 20));
    setItemManifestUrl(item.readerAssetManifestUrl ?? "");
    setItemReaderPdfUrl("");
    setItemCoverUrl(item.coverAssetUrl ?? "");
    setItemSeriesId(item.seriesId ?? "");
    setItemPdfFileName(null);
    setItemPdfFileSize(0);
    setReaderPageImages([]);
    setManifestUploadProgress(item.readerAssetManifestUrl ? 100 : 0);
    setCoverUploadProgress(item.coverAssetUrl ? 100 : 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUpdateDraft = async () => {
    if (!selectedChannelId || !editingItem) return;
    const totalPages = Math.max(1, Number(itemPages) || 1);
    try {
      setSavingDraft(true);
      setError(null);
      const res = await updateCreatorChannelLibraryItemApi(selectedChannelId, editingItem.id, {
        title: itemTitle.trim() || "Untitled draft",
        author: itemAuthor.trim() || "Unknown",
        description: itemDescription.trim() || undefined,
        contentType: itemType,
        totalPages,
        readerAssetManifestUrl: itemManifestUrl.trim() || undefined,
        coverAssetUrl: itemCoverUrl.trim() || undefined,
        seriesId: itemSeriesId || undefined,
      });
      if (!res.ok) {
        throw new Error("Failed to update draft");
      }
      resetItemForm();
      setNotice("Draft updated successfully");
      await refreshActiveChannel();
    } catch (updateError) {
      setError(getApiErrorMessage(updateError, "Failed to update draft"));
    } finally {
      setSavingDraft(false);
    }
  };

  const handleUpdateAndPublish = async () => {
    if (!selectedChannelId || !editingItem) return;
    if (!itemTitle.trim() || !itemAuthor.trim()) {
      setError("Title and author are required to publish");
      return;
    }
    if (!itemManifestUrl.trim()) {
      setError("Upload reader content before publishing");
      return;
    }
    const totalPages = Number(itemPages);
    if (!Number.isFinite(totalPages) || totalPages <= 0) {
      setError("Total pages must be a positive number");
      return;
    }
    try {
      setPublishingNewItem(true);
      setError(null);
      const res = await updateCreatorChannelLibraryItemApi(selectedChannelId, editingItem.id, {
        title: itemTitle.trim(),
        author: itemAuthor.trim(),
        description: itemDescription.trim() || undefined,
        contentType: itemType,
        totalPages,
        readerAssetManifestUrl: itemManifestUrl.trim(),
        coverAssetUrl: itemCoverUrl.trim() || undefined,
        seriesId: itemSeriesId || undefined,
      });
      if (!res.ok) {
        throw new Error("Failed to update item");
      }
      // Now publish it
      const pubRes = await publishCreatorChannelLibraryItemApi(selectedChannelId, editingItem.id);
      if (!pubRes.ok) {
        throw new Error("Item updated but failed to publish — use the Publish button");
      }
      resetItemForm();
      setNotice("Item updated and published");
      await refreshActiveChannel();
    } catch (updateError) {
      setError(getApiErrorMessage(updateError, "Failed to update and publish"));
    } finally {
      setPublishingNewItem(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedChannelId) return;
    const totalPages = Math.max(1, Number(itemPages) || 1);
    try {
      setSavingDraft(true);
      setError(null);
      const createRes = await createCreatorChannelLibraryItemApi(selectedChannelId, {
        title: itemTitle.trim() || "Untitled draft",
        author: itemAuthor.trim() || "Unknown",
        description: itemDescription.trim() || undefined,
        contentType: itemType,
        totalPages,
        readerAssetManifestUrl: itemManifestUrl.trim() || undefined,
        coverAssetUrl: itemCoverUrl.trim() || undefined,
        seriesId: itemSeriesId || undefined,
        status: "draft",
      });
      if (!createRes.ok) {
        throw new Error("Failed to save draft");
      }
      resetItemForm();
      setNotice("Draft saved successfully");
      await refreshActiveChannel();
    } catch (createError) {
      setError(getApiErrorMessage(createError, "Failed to save draft"));
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublishNewItem = async () => {
    if (!selectedChannelId) return;
    if (!itemTitle.trim() || !itemAuthor.trim()) {
      setError("Title and author are required to publish");
      return;
    }
    if (!itemManifestUrl.trim()) {
      setError("Upload reader content before publishing");
      return;
    }
    const totalPages = Number(itemPages);
    if (!Number.isFinite(totalPages) || totalPages <= 0) {
      setError("Total pages must be a positive number");
      return;
    }
    try {
      setPublishingNewItem(true);
      setError(null);
      const createRes = await createCreatorChannelLibraryItemApi(selectedChannelId, {
        title: itemTitle.trim(),
        author: itemAuthor.trim(),
        description: itemDescription.trim() || undefined,
        contentType: itemType,
        totalPages,
        readerAssetManifestUrl: itemManifestUrl.trim(),
        coverAssetUrl: itemCoverUrl.trim() || undefined,
        seriesId: itemSeriesId || undefined,
        status: "published",
      });
      if (!createRes.ok) {
        throw new Error("Failed to publish item");
      }
      resetItemForm();
      setNotice("Item published successfully");
      await refreshActiveChannel();
    } catch (createError) {
      setError(getApiErrorMessage(createError, "Failed to publish item"));
    } finally {
      setPublishingNewItem(false);
    }
  };

  const handlePublish = async (itemId: string) => {
    if (!selectedChannelId) return;
    try {
      setBusyItemId(itemId);
      setError(null);
      const res = await publishCreatorChannelLibraryItemApi(selectedChannelId, itemId);
      if (!res.ok) {
        throw new Error("Failed to publish item");
      }
      setNotice("Item published");
      await refreshActiveChannel();
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, "Failed to publish item"));
    } finally {
      setBusyItemId(null);
    }
  };

  const handleArchive = async (itemId: string) => {
    if (!selectedChannelId) return;
    try {
      setBusyItemId(itemId);
      setError(null);
      const res = await archiveCreatorChannelLibraryItemApi(selectedChannelId, itemId);
      if (!res.ok) {
        throw new Error("Failed to archive item");
      }
      setNotice("Item archived");
      await refreshActiveChannel();
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, "Failed to archive item"));
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!selectedChannelId) return;

    const confirmed = window.confirm("Delete this library item? This cannot be undone.");
    if (!confirmed) return;

    try {
      setBusyItemId(itemId);
      setError(null);
      const res = await deleteCreatorChannelLibraryItemApi(selectedChannelId, itemId);
      if (!res.ok) {
        throw new Error("Failed to delete item");
      }
      setNotice("Item deleted");
      await refreshActiveChannel();
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, "Failed to delete item"));
    } finally {
      setBusyItemId(null);
    }
  };

  const reorderSeries = async (seriesId: string, direction: "up" | "down") => {
    if (!selectedChannelId) return;
    const ordered = [...series].sort((a, b) => a.sortIndex - b.sortIndex);
    const index = ordered.findIndex((s) => s.id === seriesId);
    if (index < 0) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= ordered.length) return;

    const swapped = [...ordered];
    [swapped[index], swapped[swapIndex]] = [swapped[swapIndex], swapped[index]];

    const payload = swapped.map((s, idx) => ({
      seriesId: s.id,
      sortIndex: idx,
    }));

    try {
      setBusySeriesId(seriesId);
      setError(null);
      const res = await reorderCreatorChannelLibraryContentApi(selectedChannelId, {
        series: payload,
      });
      if (!res.ok) {
        throw new Error("Failed to reorder series");
      }
      setNotice("Series order updated");
      await refreshActiveChannel();
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, "Failed to reorder series"));
    } finally {
      setBusySeriesId(null);
    }
  };

  const reorderSeriesItem = async (itemId: string, direction: "up" | "down") => {
    if (!selectedChannelId) return;

    const current = items.find((item) => item.id === itemId);
    if (!current || !current.seriesId) return;

    const siblings = items
      .filter((item) => item.seriesId === current.seriesId)
      .sort((a, b) => a.seriesOrderIndex - b.seriesOrderIndex);

    const index = siblings.findIndex((item) => item.id === itemId);
    if (index < 0) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= siblings.length) return;

    const swapped = [...siblings];
    [swapped[index], swapped[swapIndex]] = [swapped[swapIndex], swapped[index]];

    const payload = swapped.map((item, idx) => ({
      itemId: item.id,
      seriesOrderIndex: idx,
    }));

    try {
      setBusyItemId(itemId);
      setError(null);
      const res = await reorderCreatorChannelLibraryContentApi(selectedChannelId, {
        items: payload,
      });
      if (!res.ok) {
        throw new Error("Failed to reorder series items");
      }
      setNotice("Series item sequence updated");
      await refreshActiveChannel();
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, "Failed to reorder series items"));
    } finally {
      setBusyItemId(null);
    }
  };

  const openAddToSeriesModal = (item: LibraryItem) => {
    setAddToSeriesItem(item);
    setAddToSeriesTargetId(item.seriesId ?? "");
  };

  const handleAddToSeries = async () => {
    if (!selectedChannelId || !addToSeriesItem || !addToSeriesTargetId) return;

    try {
      setAddingToSeries(true);
      setError(null);

      const siblings = items.filter((item) => item.seriesId === addToSeriesTargetId);
      const nextOrderIndex = siblings.length;

      const res = await updateCreatorChannelLibraryItemApi(selectedChannelId, addToSeriesItem.id, {
        seriesId: addToSeriesTargetId,
        seriesOrderIndex: nextOrderIndex,
      });

      if (!res.ok) {
        throw new Error("Failed to add item to series");
      }

      setNotice("Item added to series");
      setAddToSeriesItem(null);
      setAddToSeriesTargetId("");
      await refreshActiveChannel();
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, "Failed to add item to series"));
    } finally {
      setAddingToSeries(false);
    }
  };

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  return (
    <main className="min-h-screen pb-16 pt-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Library Studio</p>
            <h1 className="mt-2 text-3xl font-bold text-av-white">Exclusive Channel Library</h1>
            <p className="mt-2 max-w-3xl text-sm text-av-light-orange">
              Create series, draft reading items, and control publish/archive lifecycle for your exclusive channels.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/creator-studio"
              className="rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-light-orange hover:border-av-orange/40 hover:text-av-white"
            >
              Back to broadcast studio
            </Link>
            <Link
              href="/channels"
              className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue"
            >
              Open discovery
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-av-error/30 bg-av-error/5 p-4 text-sm text-av-error">{error}</div>
        ) : null}

        {notice ? (
          <div className="mb-6 rounded-2xl border border-av-success/30 bg-av-success/5 p-4 text-sm text-av-success">{notice}</div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
          </div>
        ) : channels.length === 0 ? (
          <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-8 text-center">
            <h2 className="text-2xl font-semibold text-av-white">No exclusive channels found</h2>
            <p className="mt-2 text-sm text-av-light-orange">
              Library management is available for exclusive channels. Create one in Creator Studio first.
            </p>
            <Link
              href="/create-channel"
              className="mt-5 inline-flex rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue"
            >
              Create exclusive channel
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-3xl border border-av-input-border/30 bg-av-card p-5">
              <label className="text-xs uppercase tracking-[0.24em] text-av-light-orange/80">Active channel</label>
              <select
                value={selectedChannelId}
                onChange={(event) => setSelectedChannelId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-av-input-border bg-av-input px-4 py-3 text-sm text-av-white focus:border-av-orange focus:outline-none"
              >
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
              {selectedChannel ? (
                <p className="mt-3 text-xs text-av-light-orange/80">
                  Managing library for {selectedChannel.name}
                </p>
              ) : null}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                <h2 className="text-lg font-semibold text-av-white">Create series</h2>
                <p className="mt-1 text-xs text-av-light-orange/80">Series help readers follow structured content arcs.</p>
                <input
                  value={seriesTitle}
                  onChange={(event) => setSeriesTitle(event.target.value)}
                  placeholder="Series title"
                  className="mt-4 w-full rounded-xl border border-av-input-border bg-av-input px-4 py-3 text-sm text-av-white placeholder-av-light-orange/60 focus:border-av-orange focus:outline-none"
                />
                <textarea
                  value={seriesDescription}
                  onChange={(event) => setSeriesDescription(event.target.value)}
                  placeholder="Series description"
                  rows={3}
                  className="mt-3 w-full rounded-xl border border-av-input-border bg-av-input px-4 py-3 text-sm text-av-white placeholder-av-light-orange/60 focus:border-av-orange focus:outline-none"
                />
                <button
                  type="button"
                  disabled={savingSeries || !seriesTitle.trim()}
                  onClick={handleCreateSeries}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSeries ? <><Spinner />Creating...</> : "Create series"}
                </button>
              </section>

              <section className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-av-white">
                      {editingItem ? `Editing: ${editingItem.title}` : "Create library item"}
                    </h2>
                    <p className="mt-1 text-xs text-av-light-orange/80">
                      {editingItem ? "Make your changes, then save the draft or publish." : "Items start as draft and can be published when ready."}
                    </p>
                  </div>
                  {editingItem ? (
                    <button
                      type="button"
                      onClick={resetItemForm}
                      className="shrink-0 rounded-full border border-av-input-border/40 px-3 py-1.5 text-xs font-semibold text-av-light-orange hover:border-av-orange/50 hover:text-av-white"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input
                    value={itemTitle}
                    onChange={(event) => setItemTitle(event.target.value)}
                    placeholder="Title"
                    className="rounded-xl border border-av-input-border bg-av-input px-4 py-3 text-sm text-av-white placeholder-av-light-orange/60 focus:border-av-orange focus:outline-none"
                  />
                  <input
                    value={itemAuthor}
                    onChange={(event) => setItemAuthor(event.target.value)}
                    placeholder="Author"
                    className="rounded-xl border border-av-input-border bg-av-input px-4 py-3 text-sm text-av-white placeholder-av-light-orange/60 focus:border-av-orange focus:outline-none"
                  />
                  <select
                    value={itemType}
                    onChange={(event) => setItemType(event.target.value as ContentType)}
                    className="rounded-xl border border-av-input-border bg-av-input px-4 py-3 text-sm text-av-white focus:border-av-orange focus:outline-none"
                  >
                    <option value="book">Book</option>
                    <option value="comic">Comic</option>
                    <option value="magazine">Magazine</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    value={itemPages}
                    onChange={(event) => setItemPages(event.target.value)}
                    type="number"
                    min={1}
                    placeholder="Total pages"
                    className="rounded-xl border border-av-input-border bg-av-input px-4 py-3 text-sm text-av-white placeholder-av-light-orange/60 focus:border-av-orange focus:outline-none"
                  />
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-av-input-border/40 bg-av-input/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-av-light-orange/75">Book content</p>
                    <p className="mt-1 text-xs text-av-light-orange/70">Upload one PDF, or upload page images in first-to-last order. We auto-generate reader data for you.</p>
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        void handleReaderPdfSelected(file);
                      }}
                    />
                    <input
                      ref={pageImagesInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const files = event.target.files ? Array.from(event.target.files) : [];
                        if (files.length === 0) return;
                        void handleReaderPagesSelected(files);
                      }}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={manifestUploading || !selectedChannelId}
                        onClick={() => pdfInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-full border border-av-input-border/50 px-3 py-1.5 text-xs font-semibold text-av-white disabled:opacity-40"
                      >
                        {manifestUploading ? <><Spinner size="xs" />Uploading...</> : "Upload PDF"}
                      </button>
                      <button
                        type="button"
                        disabled={manifestUploading || !selectedChannelId}
                        onClick={() => pageImagesInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-full border border-av-input-border/50 px-3 py-1.5 text-xs font-semibold text-av-white disabled:opacity-40"
                      >
                        {manifestUploading ? <><Spinner size="xs" />Uploading...</> : "Upload page images"}
                      </button>
                      {itemManifestUrl ? (
                        <button
                          type="button"
                          disabled={manifestUploading}
                          onClick={() => {
                            setItemManifestUrl("");
                            setItemReaderPdfUrl("");
                            setItemPdfFileName(null);
                            setItemPdfFileSize(0);
                            setReaderPageImages([]);
                            setManifestUploadProgress(0);
                            if (pdfInputRef.current) pdfInputRef.current.value = "";
                            if (pageImagesInputRef.current) pageImagesInputRef.current.value = "";
                          }}
                          className="rounded-full border border-av-input-border/30 px-3 py-1.5 text-xs font-semibold text-av-light-orange disabled:opacity-40"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-av-dark-blue/60">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-av-orange to-av-light-orange transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, manifestUploadProgress))}%` }}
                      />
                    </div>

                    {itemManifestUrl ? (
                      <div className="mt-2 space-y-1">
                        {itemPdfFileName ? (
                          <p className="text-xs text-av-light-orange/80">PDF: {itemPdfFileName} • {formatBytes(itemPdfFileSize)}</p>
                        ) : null}
                        {readerPageImages.length > 0 ? (
                          <p className="text-xs text-av-light-orange/80">Pages: {readerPageImages.length} image{readerPageImages.length > 1 ? "s" : ""} uploaded</p>
                        ) : null}
                        {itemReaderPdfUrl ? (
                          <a href={itemReaderPdfUrl} target="_blank" rel="noreferrer" className="text-xs text-av-orange hover:text-av-light-orange">
                            Preview generated PDF
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-av-light-orange/60">No reader content uploaded yet.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-av-input-border/40 bg-av-input/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-av-light-orange/75">Cover image (optional)</p>
                    <p className="mt-1 text-xs text-av-light-orange/70">Upload an image for instant card preview.</p>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        void handleCoverSelected(file);
                      }}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={coverUploading || !selectedChannelId}
                        onClick={() => coverInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-full border border-av-input-border/50 px-3 py-1.5 text-xs font-semibold text-av-white disabled:opacity-40"
                      >
                        {coverUploading ? <><Spinner size="xs" />Uploading...</> : "Upload cover"}
                      </button>
                      {itemCoverUrl ? (
                        <button
                          type="button"
                          disabled={coverUploading}
                          onClick={() => {
                            setItemCoverUrl("");
                            setCoverUploadProgress(0);
                            if (coverInputRef.current) coverInputRef.current.value = "";
                          }}
                          className="rounded-full border border-av-input-border/30 px-3 py-1.5 text-xs font-semibold text-av-light-orange disabled:opacity-40"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-av-dark-blue/60">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-av-orange to-av-light-orange transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, coverUploadProgress))}%` }}
                      />
                    </div>

                    {itemCoverUrl ? (
                      <div className="mt-3 overflow-hidden rounded-xl border border-av-input-border/40">
                        <Image src={itemCoverUrl} alt="Cover preview" width={640} height={224} className="h-28 w-full object-cover" unoptimized />
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-av-light-orange/60">No cover uploaded yet.</p>
                    )}
                  </div>
                </div>
                <textarea
                  value={itemDescription}
                  onChange={(event) => setItemDescription(event.target.value)}
                  rows={3}
                  placeholder="Description"
                  className="mt-3 w-full rounded-xl border border-av-input-border bg-av-input px-4 py-3 text-sm text-av-white placeholder-av-light-orange/60 focus:border-av-orange focus:outline-none"
                />
                <select
                  value={itemSeriesId}
                  onChange={(event) => setItemSeriesId(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-av-input-border bg-av-input px-4 py-3 text-sm text-av-white focus:border-av-orange focus:outline-none"
                >
                  <option value="">No series</option>
                  {series.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={savingDraft || publishingNewItem || manifestUploading || coverUploading || !selectedChannelId}
                    onClick={editingItem ? handleUpdateDraft : handleSaveDraft}
                    className="inline-flex items-center gap-2 rounded-full border border-av-input-border/40 px-5 py-2.5 text-sm font-semibold text-av-light-orange disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingDraft ? <><Spinner />Saving...</> : (editingItem ? "Update draft" : "Save as draft")}
                  </button>
                  <button
                    type="button"
                    disabled={savingDraft || publishingNewItem || manifestUploading || coverUploading || !selectedChannelId}
                    onClick={editingItem ? handleUpdateAndPublish : handlePublishNewItem}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {publishingNewItem ? <><Spinner />Publishing...</> : (editingItem ? "Update & publish" : "Publish")}
                  </button>
                </div>
              </section>
            </div>

            <div className="mt-8 rounded-3xl border border-av-input-border/30 bg-av-card p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-av-white">Series ordering</h2>
                <span className="text-xs text-av-light-orange/80">Controls next-book sequencing across each series</span>
              </div>

              {series.length === 0 ? (
                <p className="text-sm text-av-light-orange/80">No series created yet.</p>
              ) : (
                <div className="space-y-3">
                  {[...series]
                    .sort((a, b) => a.sortIndex - b.sortIndex)
                    .map((s, index, orderedSeries) => (
                      <article key={s.id} className="rounded-2xl border border-av-input-border/30 bg-av-input/35 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-av-white">{s.title}</p>
                            <p className="mt-1 text-xs text-av-light-orange/80">Position {index + 1} • {s.status}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={busySeriesId === s.id || index === 0}
                              onClick={() => reorderSeries(s.id, "up")}
                              className="inline-flex items-center gap-1.5 rounded-full border border-av-input-border/30 px-3 py-1.5 text-xs font-semibold text-av-white disabled:opacity-40"
                            >
                              {busySeriesId === s.id ? <Spinner size="xs" /> : null}
                              Move Up
                            </button>
                            <button
                              type="button"
                              disabled={busySeriesId === s.id || index === orderedSeries.length - 1}
                              onClick={() => reorderSeries(s.id, "down")}
                              className="inline-flex items-center gap-1.5 rounded-full border border-av-input-border/30 px-3 py-1.5 text-xs font-semibold text-av-white disabled:opacity-40"
                            >
                              {busySeriesId === s.id ? <Spinner size="xs" /> : null}
                              Move Down
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </div>

            <div className="mt-8 rounded-3xl border border-av-input-border/30 bg-av-card p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-av-white">Library items</h2>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as ItemStatus)}
                  className="rounded-xl border border-av-input-border bg-av-input px-4 py-2.5 text-sm text-av-white focus:border-av-orange focus:outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {visibleItems.length === 0 ? (
                <p className="text-sm text-av-light-orange/80">No items for this filter yet.</p>
              ) : (
                <div className="space-y-3">
                  {visibleItems.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-av-input-border/30 bg-av-input/40 p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-base font-semibold text-av-white">{item.title}</p>
                          <p className="mt-1 text-xs text-av-light-orange/80">
                            {item.author} • {item.contentType} • {item.totalPages} pages
                          </p>
                          <p className="mt-1 text-xs text-av-light-orange/70">
                            {item.seriesId ? `Series sequence #${item.seriesOrderIndex + 1}` : "Standalone item"}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-av-orange/80">{item.status}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.status === "draft" ? (
                            <button
                              type="button"
                              onClick={() => handleEditItem(item)}
                              disabled={busyItemId === item.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-av-orange/40 px-4 py-2 text-xs font-semibold text-av-light-orange disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Edit
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openAddToSeriesModal(item)}
                            disabled={busyItemId === item.id || series.length === 0}
                            className="inline-flex items-center gap-1.5 rounded-full border border-av-input-border/30 px-4 py-2 text-xs font-semibold text-av-white disabled:cursor-not-allowed disabled:opacity-60"
                            title={series.length === 0 ? "Create a series first" : "Add this item to a series"}
                          >
                            Add to Series
                          </button>
                          {item.seriesId ? (
                            <>
                              <button
                                type="button"
                                onClick={() => reorderSeriesItem(item.id, "up")}
                                disabled={busyItemId === item.id}
                                className="inline-flex items-center gap-1.5 rounded-full border border-av-input-border/30 px-4 py-2 text-xs font-semibold text-av-white disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {busyItemId === item.id ? <Spinner size="xs" /> : null}
                                Seq Up
                              </button>
                              <button
                                type="button"
                                onClick={() => reorderSeriesItem(item.id, "down")}
                                disabled={busyItemId === item.id}
                                className="inline-flex items-center gap-1.5 rounded-full border border-av-input-border/30 px-4 py-2 text-xs font-semibold text-av-white disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {busyItemId === item.id ? <Spinner size="xs" /> : null}
                                Seq Down
                              </button>
                            </>
                          ) : null}
                          {item.status !== "published" ? (
                            <button
                              type="button"
                              onClick={() => handlePublish(item.id)}
                              disabled={busyItemId === item.id}
                              className="inline-flex items-center gap-1.5 rounded-full bg-av-success/20 px-4 py-2 text-xs font-semibold text-av-success disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {busyItemId === item.id ? <Spinner size="xs" /> : null}
                              Publish
                            </button>
                          ) : null}
                          {item.status !== "archived" ? (
                            <button
                              type="button"
                              onClick={() => handleArchive(item.id)}
                              disabled={busyItemId === item.id}
                              className="inline-flex items-center gap-1.5 rounded-full bg-av-warning/20 px-4 py-2 text-xs font-semibold text-av-warning disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {busyItemId === item.id ? <Spinner size="xs" /> : null}
                              Archive
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            disabled={busyItemId === item.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-av-error/20 px-4 py-2 text-xs font-semibold text-av-error disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyItemId === item.id ? <Spinner size="xs" /> : null}
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {/* Pagination controls */}
              {itemsTotalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-av-input-border/20 pt-4">
                  <p className="text-xs text-av-light-orange/70">
                    {itemsTotal} item{itemsTotal !== 1 ? "s" : ""} • Page {itemsPage} of {itemsTotalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleItemsPageChange(itemsPage - 1)}
                      disabled={itemsPage <= 1}
                      className="rounded-lg border border-av-input-border/30 px-4 py-2 text-xs font-semibold text-av-white transition hover:border-av-orange/40 hover:bg-av-orange/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleItemsPageChange(itemsPage + 1)}
                      disabled={itemsPage >= itemsTotalPages}
                      className="rounded-lg border border-av-input-border/30 px-4 py-2 text-xs font-semibold text-av-white transition hover:border-av-orange/40 hover:bg-av-orange/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {addToSeriesItem ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-av-dark-blue/80 px-4">
            <div className="w-full max-w-lg rounded-3xl border border-av-input-border/40 bg-av-card p-6">
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.2em] text-av-light-orange">Library item</p>
                <h3 className="mt-1 text-xl font-semibold text-av-white">Add to series</h3>
                <p className="mt-2 text-sm text-av-light-orange/80">{addToSeriesItem.title}</p>
              </div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-av-light-orange/70">
                Choose series
              </label>
              <select
                value={addToSeriesTargetId}
                onChange={(event) => setAddToSeriesTargetId(event.target.value)}
                className="w-full rounded-2xl border border-av-input-border/30 bg-av-input/40 px-4 py-3 text-sm text-av-white outline-none transition focus:border-av-orange/50"
              >
                <option value="" disabled>
                  Select a series
                </option>
                {series.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                  </option>
                ))}
              </select>

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (addingToSeries) return;
                    setAddToSeriesItem(null);
                    setAddToSeriesTargetId("");
                  }}
                  disabled={addingToSeries}
                  className="inline-flex items-center rounded-full border border-av-input-border/30 px-4 py-2 text-xs font-semibold text-av-light-orange disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddToSeries}
                  disabled={addingToSeries || !addToSeriesTargetId}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-2 text-xs font-semibold text-av-dark-blue disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {addingToSeries ? <Spinner size="xs" /> : null}
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
