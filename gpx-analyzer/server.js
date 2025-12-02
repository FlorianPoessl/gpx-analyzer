const express = require('express');
const path = require('path');

const app = express();

app.use(express.static(path.join(__dirname, 'dist/gpx-analyzer/browser')));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/gpx-analyzer/browser/index.html'));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});