const express = require('express');
const crypto = require('crypto');
const books = require('./booksdb.js');

const regd_users = express.Router();
const users = [];
const PASSWORD_KEY_LENGTH = 64;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, PASSWORD_KEY_LENGTH, (error, key) => {
      if (error) reject(error);
      else resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

async function addUser(username, password) {
  users.push({ username, passwordHash: await hashPassword(password) });
}

const isValid = (username) => users.some((user) => user.username === username);

async function authenticatedUser(username, password) {
  const user = users.find((candidate) => candidate.username === username);
  if (!user) return false;
  const [salt, expectedHex] = user.passwordHash.split(':');
  const actual = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, PASSWORD_KEY_LENGTH, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

regd_users.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
  if (!(await authenticatedUser(username.trim(), password))) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }
  req.session.username = username.trim();
  const token = require('jsonwebtoken').sign({ username: username.trim() }, process.env.JWT_SECRET || 'local-development-secret', { expiresIn: '1h' });
  return res.json({ message: 'Login successful.', token });
});

function currentUsername(req) {
  if (req.authenticatedUsername) return req.authenticatedUsername;
  if (req.session && req.session.username) return req.session.username;
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) {
    try {
      return require('jsonwebtoken').verify(header.slice(7), process.env.JWT_SECRET || 'local-development-secret').username;
    } catch (_) {
      return null;
    }
  }
  return null;
}

function reviewBody(req) {
  const review = req.body && (req.body.review || req.body);
  return typeof review === 'string' && review.trim() ? review.trim() : null;
}

regd_users.put('/auth/review/:isbn', (req, res) => {
  const username = currentUsername(req);
  if (!username) return res.status(401).json({ message: 'Authentication required.' });
  const book = books[req.params.isbn];
  if (!book) return res.status(404).json({ message: 'Book not found.' });
  const review = reviewBody(req);
  if (!review) return res.status(400).json({ message: 'A non-empty review is required.' });
  book.reviews[username] = review;
  return res.status(200).json({ message: 'Review added or updated successfully.', reviews: book.reviews });
});

regd_users.patch('/auth/review/:isbn', (req, res) => {
  const username = currentUsername(req);
  if (!username) return res.status(401).json({ message: 'Authentication required.' });
  const book = books[req.params.isbn];
  if (!book) return res.status(404).json({ message: 'Book not found.' });
  if (!Object.prototype.hasOwnProperty.call(book.reviews, username)) return res.status(404).json({ message: 'Your review was not found.' });
  const review = reviewBody(req);
  if (!review) return res.status(400).json({ message: 'A non-empty review is required.' });
  book.reviews[username] = review;
  return res.json({ message: 'Review updated successfully.', reviews: book.reviews });
});

regd_users.delete('/auth/review/:isbn', (req, res) => {
  const username = currentUsername(req);
  if (!username) return res.status(401).json({ message: 'Authentication required.' });
  const book = books[req.params.isbn];
  if (!book) return res.status(404).json({ message: 'Book not found.' });
  if (!Object.prototype.hasOwnProperty.call(book.reviews, username)) return res.status(404).json({ message: 'Your review was not found.' });
  delete book.reviews[username];
  return res.json({ message: 'Review deleted successfully.', reviews: book.reviews });
});

module.exports = { authenticated: regd_users, isValid, users, addUser, authenticatedUser };
