//This file is meant to aggregate the relevant autogenerated files from starport
//and put them into a useable place inside the SDK.

//This file is meant to be run from the ts-sdk directory.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CERTUS_DIRECTORY = "../vue/src/store/generated/certusone/wormhole-chain/";
const COSMOS_DIRECTORY = "../vue/src/store/generated/cosmos/cosmos-sdk/";
const MODULE_DIRECTORY = "../ts-sdk/src/modules/";
const VUE_DIRECTORY = "../vue";

function execWrapper(command) {
  execSync(command, (error, stdout, stderr) => {
    if (error) {
      console.log(
        `error while processing command - ${command}: ${error.message}`
      );
      return;
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
  });
}

const certusFiles = fs.readdirSync(CERTUS_DIRECTORY, { withFileTypes: true }); //should only contain directories for the modules
const cosmosFiles = fs.readdirSync(COSMOS_DIRECTORY, { withFileTypes: true });

certusFiles.forEach((directory) => {
  execWrapper(`mkdir -p ${MODULE_DIRECTORY + directory.name}/`);
  execWrapper(
    `cp -R ${CERTUS_DIRECTORY + directory.name}/module/* ${
      MODULE_DIRECTORY + directory.name
    }/`
  ); //move all the files from the vue module into the sdk
});

cosmosFiles.forEach((directory) => {
  execWrapper(`mkdir -p ${MODULE_DIRECTORY + directory.name}/`);
  execWrapper(
    `cp -R ${COSMOS_DIRECTORY + directory.name}/module/* ${
      MODULE_DIRECTORY + directory.name
    }/`
  ); //move all the files from the vue module into the sdk
});

//As of 19.5 javascript isn't emitted
//execWrapper(`find ${MODULE_DIRECTORY} -name "*.js" | xargs rm `); //delete all javascript files, so they can be cleanly created based on our tsconfig

function getFilesRecursively(directory) {
  const filesInDirectory = fs.readdirSync(directory);

  return filesInDirectory.flatMap((file) => {
    const absolute = path.join(directory, file);
    if (fs.statSync(absolute).isDirectory()) {
      return getFilesRecursively(absolute);
    } else {
      return [absolute];
    }
  });
}

const files = getFilesRecursively(MODULE_DIRECTORY);

files.forEach((path) => {
  const fileContent = fs.readFileSync(path);
  const fileString = fileContent.toString("UTF-8");
  const fileStringModified = "//@ts-nocheck\n" + fileString;
  fs.writeFileSync(path, fileStringModified);
});

console.log("Successfully copied all autogenerated typescript files");
