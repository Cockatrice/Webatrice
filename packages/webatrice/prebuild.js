const fse = require('fs-extra');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const ROOT_DIR = './src';
const PUBLIC_DIR = './public';

const i18nDefaultFile = `${ROOT_DIR}/i18n-default.json`;
const versionFile = `${PUBLIC_DIR}/version.txt`;

const i18nFileRegex = /\.i18n\.json$/;

const i18nOnly = process.argv.indexOf('-i18nOnly') > -1;

(async () => {
  if (i18nOnly) {
    await createI18NDefault();
    return;
  }

  await createVersionFile();
  await createI18NDefault();
})();

// Vite copies public/ verbatim into build/, so this lands at build/version.txt
// and is served at /version.txt in both dev and production.
async function createVersionFile() {
  try {
    await fse.outputFile(versionFile, `${await getCommitHash()}\n`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
}

async function createI18NDefault() {
  try {
    const files = getAllFiles(ROOT_DIR, i18nFileRegex);
    const allJson = await Promise.all(files.map(file => fse.readJson(file)));

    const rollup = allJson.reduce((acc, json) => {
      const newKeys = Object.keys(json);

      newKeys.forEach(key => {
        if (acc[key]) {
          throw new Error(`i18n key collision: ${key}\n${JSON.stringify(json)}`);
        }

        acc[key] = json[key];
      });

      return acc;
    }, {});

    fse.outputFile(i18nDefaultFile, JSON.stringify(rollup, null, 2));
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
}

async function getCommitHash() {
  return (await exec('git rev-parse HEAD')).stdout.trim();
}

function getAllFiles(dirPath, regex = /./, allFiles = []) {
  return fse.readdirSync(dirPath).reduce((files, file) => {
    const filePath = dirPath + "/" + file;

    if (fse.statSync(filePath).isDirectory()) {
      files.concat(getAllFiles(filePath, regex, files));
    } else if (regex.test(file)) {
      files.push(path.join(__dirname, filePath));
    }

    return files;
  }, allFiles);
}
