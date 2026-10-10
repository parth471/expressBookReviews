const express = require('express');
const axios = require('axios');
const books = require('./booksdb.js');
const { isValid, addUser } = require('./auth_users.js');

const public_users = express.Router();

// Register users with a salted password hash (the hashing helper lives in auth_users.js).
public_users.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Username and a password of at least 8 characters are required.' });
  }
  if (isValid(username.trim())) return res.status(409).json({ message: 'Username already exists.' });
  await addUser(username.trim(), password);
  return res.status(201).json({ message: 'User successfully registered.' });
});

public_users.get('/', (req, res) => res.json(books));

public_users.get('/isbn/:isbn', (req, res) => {
  const book = books[req.params.isbn];
  return book ? res.json(book) : res.status(404).json({ message: 'Book not found.' });
});

public_users.get('/author/:author', (req, res) => {
  const author = req.params.author.toLocaleLowerCase();
  const matches = Object.fromEntries(Object.entries(books).filter(([, book]) => book.author.toLocaleLowerCase().includes(author)));
  return res.json(matches);
});

public_users.get('/title/:title', (req, res) => {
  const title = req.params.title.toLocaleLowerCase();
  const matches = Object.fromEntries(Object.entries(books).filter(([, book]) => book.title.toLocaleLowerCase().includes(title)));
  return res.json(matches);
});

public_users.get('/review/:isbn', (req, res) => {
  const book = books[req.params.isbn];
  return book ? res.json(book.reviews) : res.status(404).json({ message: 'Book not found.' });
});

// The client helpers below call this API. Keep the port configurable for local demos.
const baseURL = process.env.BOOK_API_URL || 'http://localhost:5000';
function responseData(response) {
  if (!response || !response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
    throw new Error('The book API returned an invalid response.');
  }
  return response.data;
}

function getAllBooks(callback) {
  if (typeof callback !== 'function') throw new TypeError('getAllBooks expects a callback.');
  axios.get(`${baseURL}/`).then(responseData).then((data) => callback(null, data)).catch((error) => callback(error, null));
}

function getBookByISBN(isbn) {
  return axios.get(`${baseURL}/isbn/${encodeURIComponent(isbn)}`).then(responseData);
}

function getBooksByAuthor(author) {
  return axios.get(`${baseURL}/author/${encodeURIComponent(author)}`).then(responseData);
}

function getBooksByTitle(title) {
  return axios.get(`${baseURL}/title/${encodeURIComponent(title)}`).then(responseData);
}

module.exports = {
  general: public_users,
  getAllBooks,
  getBookByISBN,
  getBooksByAuthor,
  getBooksByTitle,
};
