# Online Book Review API

This project preserves IBM's ten preloaded books and exposes public book searches plus user registration, login, and personal reviews.

## Install and run

```powershell
cd final_project
npm.cmd install
npm.cmd start
```

The API listens on port 5000 by default. Set `PORT`, `JWT_SECRET`, and `SESSION_SECRET` in the environment to override local development settings. User accounts and reviews are held in memory and reset when the server restarts.

## Routes

- `GET /`, `GET /isbn/:isbn`, `GET /author/:author`, `GET /title/:title`, `GET /review/:isbn`
- `POST /register` with `{ "username": "...", "password": "at-least-8-characters" }`
- `POST /customer/login` with the same credentials; returns a bearer token and also sets a session cookie.
- `PUT /customer/auth/review/:isbn` to add or replace your review, `PATCH` to edit your existing review, and `DELETE` to remove your review. Review body: `{ "review": "..." }`. Supply `Authorization: Bearer <token>` or use the login session cookie.

Passwords are stored as salted scrypt hashes. Reviews are keyed by username, so one user cannot alter another user's review.

## Axios Task 10

`router/general.js` exports `getAllBooks(callback)`, `getBookByISBN(isbn)`, `getBooksByAuthor(author)`, and `getBooksByTitle(title)`. The latter three return Promises. Set `BOOK_API_URL` to change the client base URL. With the server running, execute `npm.cmd run demo:general`.

## Checks

With Node.js installed, run `npm.cmd test` for API and Axios integration checks. They start their own temporary server on port 5178.
