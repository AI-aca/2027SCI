const fs = require('fs');
const filePath = 'index.html';
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/<button id="btn-delete-ps-history".*?<\/button>/g, '');
fs.writeFileSync(filePath, content, 'utf8');
