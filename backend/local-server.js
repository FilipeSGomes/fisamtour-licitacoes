// Servidor local para desenvolvimento: `node local-server.js` (não usado na Vercel,
// que importa api/index.js diretamente como função serverless).
require("dotenv").config();
const app = require("./api/index.js");

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API local em http://localhost:${port}`));
