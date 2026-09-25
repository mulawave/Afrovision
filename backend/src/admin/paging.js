/**
 * Cursor paging for append-only admin collections ordered by a numeric
 * millisecond timestamp field (newest first).
 *
 * Unfiltered: one ordered query, `limit` reads.
 * Filtered (equality on one field): walks the ordered collection and filters
 * in code, reading at most MAX_SCAN docs per request, so no composite index is
 * needed. The returned cursor continues exactly where the scan stopped.
 */
const MAX_PAGE = 200;
const MAX_SCAN = 500;

async function pageByTime(db, collection, timeField, { limit = 50, before = null, filter = null, map = (d) => d } = {}) {
  const size = Math.min(Math.max(1, Number(limit) || 50), MAX_PAGE);
  const cursor = before != null && before !== '' && Number.isFinite(Number(before)) ? Number(before) : null;

  const base = () => {
    let q = db.collection(collection).orderBy(timeField, 'desc');
    if (cursor != null) q = q.where(timeField, '<', cursor);
    return q;
  };

  if (!filter) {
    // Fetch one extra row so "no more pages" is known exactly (no empty last page).
    const snap = await base().limit(size + 1).get();
    const docs = snap.docs.slice(0, size);
    const items = docs.map((doc) => map({ id: doc.id, ...doc.data() }));
    const more = snap.docs.length > size;
    return { items, nextBefore: more ? docs[docs.length - 1].get(timeField) : null, scanned: snap.docs.length };
  }

  const [field, value] = filter;
  const items = [];
  let scanned = 0;
  let lastTime = cursor;
  let exhausted = false;
  while (items.length < size && scanned < MAX_SCAN) {
    let q = db.collection(collection).orderBy(timeField, 'desc');
    if (lastTime != null) q = q.where(timeField, '<', lastTime);
    const batch = Math.min(200, MAX_SCAN - scanned);
    const snap = await q.limit(batch).get();
    scanned += snap.docs.length;
    for (const doc of snap.docs) {
      lastTime = doc.get(timeField);
      if (doc.get(field) === value) {
        items.push(map({ id: doc.id, ...doc.data() }));
        if (items.length === size) break;
      }
    }
    if (snap.docs.length < batch) {
      exhausted = true;
      break;
    }
  }
  return { items, nextBefore: exhausted && items.length < size ? null : lastTime, scanned };
}

module.exports = { pageByTime, MAX_PAGE, MAX_SCAN };
