const { Router } = require('express');
const Category = require('./category.model');

const router = Router();

router.get('/', (req, res) => {
  const categories = Category.getActive();
  res.json({ categories });
});

module.exports = router;
