const express = require('express');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const customerRoutes = require('./router/auth_users.js').authenticated;
const generalRoutes = require('./router/general.js').general;

const app = express();
app.use(express.json());
app.use('/customer', session({
  secret: process.env.SESSION_SECRET || 'local-development-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' },
}));

app.use('/customer/auth', (req, res, next) => {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) {
    try {
      req.authenticatedUsername = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'local-development-secret').username;
    } catch (_) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
  } else if (!req.session.username) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  next();
});

app.use('/customer', customerRoutes);
app.use('/', generalRoutes);

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'Malformed JSON request body.' });
  }
  console.error(error);
  return res.status(500).json({ message: 'Internal server error.' });
});

const PORT = Number(process.env.PORT) || 5000;
if (require.main === module) app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
module.exports = app;
