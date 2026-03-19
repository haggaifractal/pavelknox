const fs = require('fs');
const path = require('path');

function copyFolderSync(from, to) {
    fs.mkdirSync(to, { recursive: true });
    fs.readdirSync(from).forEach(element => {
        const fromPath = path.join(from, element);
        const toPath = path.join(to, element);
        if (fs.lstatSync(fromPath).isFile()) {
            fs.copyFileSync(fromPath, toPath);
        } else {
            copyFolderSync(fromPath, toPath);
        }
    });
}

try {
    copyFolderSync('pavelknox-web', '.');
    fs.rmSync('pavelknox-web', { recursive: true, force: true });
    console.log('Moved files successfully.');
} catch (e) {
    console.error('Error:', e);
}
