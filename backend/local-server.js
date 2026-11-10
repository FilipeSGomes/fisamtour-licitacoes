const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = require("./src/app");
const { ensureAdmin } = require("./src/bootstrap");

const port = Number(process.env.PORT || 3001);

ensureAdmin()
  .then(() => {
    app.listen(port, () => {
      console.log(`Ponto FISAM em http://127.0.0.1:${port}`);
    });
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
