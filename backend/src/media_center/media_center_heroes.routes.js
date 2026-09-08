const { Router } = require('express');
const ctrl = require('./media_center_heroes.controller');

/**
 * Public routes for Media Center hero banners.
 * Mounted at `/media-center/heroes` in app.js. Admin CRUD is mounted
 * separately under `/admin/media-center/heroes` in admin.routes.js.
 */
const router = Router();

router.get('/heroes', ctrl.listHeroes);

module.exports = router;
