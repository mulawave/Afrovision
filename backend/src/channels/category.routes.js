const { Router } = require('express');
const Category = require('./category.model');

const router = Router();

router.get('/', async (req, res) => {
  const categories = await Category.getActive();
  res.json({ categories });
});

module.exports = router;
