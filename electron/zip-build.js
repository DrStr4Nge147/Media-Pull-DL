import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const version = pkg.version;
const zipName = `Media-Pull_DL_win-unpacked_v${version}.zip`;
const sourceDir = 'dist_electron/win-unpacked';
const destPath = path.join('dist_electron', zipName);

console.log(`Starting compression: ${sourceDir} -> ${destPath}`);

if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Source directory "${sourceDir}" not found.`);
    process.exit(1);
}

try {
    // Windows specific command to create zip
    // Using powershell's Compress-Archive
    const command = `powershell -Command "Compress-Archive -Path '${sourceDir}/*' -DestinationPath '${destPath}' -Force"`;
    execSync(command, { stdio: 'inherit' });
    console.log(`Successfully created: ${zipName}`);
} catch (error) {
    console.error('Compression failed:', error);
    process.exit(1);
}
