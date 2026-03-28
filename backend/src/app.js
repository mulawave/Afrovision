require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./auth/auth.routes');
const userRoutes = require('./users/user.routes');
const adminRoutes = require('./admin/admin.routes');
const subscriptionRoutes = require('./subscriptions/subscription.routes');
const channelRoutes = require('./channels/channel.routes');
const categoryRoutes = require('./channels/category.routes');
const homeRoutes = require('./channels/home.routes');
const currencyRoutes = require('./currencies/currency.routes');
const vptRoutes = require('./vpt/vpt.routes');
const walletRoutes = require('./wallet/wallet.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/channels', channelRoutes);
app.use('/categories', categoryRoutes);
app.use('/home', homeRoutes);
app.use('/currencies', currencyRoutes);
app.use('/vpt', vptRoutes);
app.use('/wallet', walletRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'AfroVision API running' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
