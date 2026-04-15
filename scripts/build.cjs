#!/usr/bin/env node
/**********************************************************************
 * Copyright (C) 2022 - 2024 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

const AdmZip = require('adm-zip');
const path = require('path');
const package = require('../package.json');
const { mkdirp } = require('mkdirp');
const fs = require('fs');
const byline = require('byline');
const cp = require('copyfiles');
const cproc = require('node:child_process');

const destFile = path.resolve(__dirname, `../${package.name}.cdix`);
const builtinDirectory = path.resolve(__dirname, '../builtin');
const zipDirectory = path.resolve(builtinDirectory, `${package.name}.cdix`);
const extFiles = path.resolve(__dirname, '../.extfiles');
const fileStream = fs.createReadStream(extFiles, { encoding: 'utf8' });

/** @type {string | undefined} */
let urlProtocol;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--url-protocol') {
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      urlProtocol = next;
      i++;
    }
  }
}

const includedFiles = [];
const excludedFiles = [];

function applyUrlProtocolToSuccessHtml() {
  if (urlProtocol === undefined || urlProtocol === '') {
    return;
  }
  const successHtmlPath = path.join(zipDirectory, 'www/success.html');
  if (!fs.existsSync(successHtmlPath)) {
    console.error(`Error: file not found: ${successHtmlPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(successHtmlPath, 'utf8');
  const updated = content.replaceAll('podman-desktop', urlProtocol);
  fs.writeFileSync(successHtmlPath, updated, 'utf8');
}

// remove the .cdix file before zipping
if (fs.existsSync(destFile)) {
  fs.rmSync(destFile);
}
// remove the builtin folder before zipping
if (fs.existsSync(builtinDirectory)) {
  fs.rmSync(builtinDirectory, { recursive: true, force: true });
}

// install external modules into dist folder
cproc.exec('pnpm init', { cwd: './dist' }, (error, stdout, stderr) => {
  if (error) {
    console.log(stdout);
    console.log(stderr);
    throw error;
  }

  cproc.exec('pnpm install object-hash@2.2.0', { cwd: './dist' }, (error, stdout, stderr) => {
    if (error) {
      console.log(stdout);
      console.log(stderr);
      throw error;
    }

    byline(fileStream)
      .on('data', line => {
        line.startsWith('!') ? excludedFiles.push(line.substring(1)) : includedFiles.push(line);
      })
      .on('error', () => {
        throw new Error('Error reading .extfiles');
      })
      .on('end', () => {
        includedFiles.push(zipDirectory); // add destination dir
        mkdirp.sync(zipDirectory);
        console.log(`Copying files to ${zipDirectory}`);
        cp(includedFiles, { exclude: excludedFiles }, error => {
          if (error) {
            throw new Error('Error copying files', error);
          }
          applyUrlProtocolToSuccessHtml();
          console.log(`Zipping files to ${destFile}`);
          const zip = new AdmZip();
          zip.addLocalFolder(zipDirectory);
          zip.writeZip(destFile);
        });
      });
  });
});
