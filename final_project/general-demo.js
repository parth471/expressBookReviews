const { getAllBooks, getBookByISBN, getBooksByAuthor, getBooksByTitle } = require('./router/general.js');

async function main() {
  const books = await new Promise((resolve, reject) => {
    getAllBooks((error, data) => error ? reject(error) : resolve(data));
  });
  const isbn = await getBookByISBN('1');
  const byAuthor = await getBooksByAuthor('Chinua Achebe');
  const byTitle = await getBooksByTitle('Things Fall Apart');
  console.log(JSON.stringify({ totalBooks: Object.keys(books).length, isbn1: isbn, authorMatches: byAuthor, titleMatches: byTitle }, null, 2));
}

main().catch((error) => {
  console.error(`general.js demo failed: ${error.message}`);
  process.exitCode = 1;
});
