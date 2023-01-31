#!/usr/bin/env node
import { Command } from "commander";
import toml from "toml";
import fs from "fs/promises";
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
const program = new Command();

const REQUIRED_KEYS = [
  "Region",
  "CICDApi",
  "CognitoUserPoolID",
  "CognitoWebClientID",
];

const writeConfigFile = (src, dest, configMap) =>
  fs
    .readFile(src)
    .then((data) =>
      Object.entries(configMap).reduce(
        (acc, [k, v]) => acc.replace(`<${k}>`, v),
        data.toString()
      )
    )
    .then((data) => fs.writeFile(dest, data));
const getOutputs = async (stackName, region = null) => {
  const clientConfig = {};
  if (region) clientConfig.region = region;
  const client = new CloudFormationClient(clientConfig);
  const command = new DescribeStacksCommand({
    StackName: stackName,
  });
  const res = await client.send(command);
  const stack = res.Stacks.find((i) => i.StackName === stackName);
  if (!stack) throw new Error("Stack not found");
  const outputMap = stack.Outputs.reduce(
    (acc, next) => ({
      ...acc,
      [next.OutputKey]: next.OutputValue,
    }),
    {}
  );
  if (REQUIRED_KEYS.some((i) => !(i in outputMap)))
    throw new Error(
      `Stack outputs missing required keys: ${JSON.stringify(outputMap)}`
    );
  return outputMap;
};

const getStackDetails = (configFile, env) => {
  return fs
    .readFile(`../${configFile}`)
    .then((data) => toml.parse(data))
    .then((data) => data[env].deploy.parameters)
    .then((data) => ({
      stackName: data.stack_name,
      region: data.region,
    }));
};

const generateConfig = (options) => {
  const { samConfig, samConfigEnv, debug } = options;

  if (debug) {
    console.debug(`SAM config file: ${samConfig}`);
    console.debug(`SAM config env: ${samConfigEnv}`);
  }

  getStackDetails(samConfig, samConfigEnv)
    .then((details) => getOutputs(details.stackName, details.region))
    .then((stackOutputs) =>
      writeConfigFile(".env.template", ".env.local", stackOutputs)
    )
    .then(() => console.log("Config generated successfully!"))
    .catch((err) => console.error(`Failed to generate config file: ${err}`));
};

const echoOutput = (output) => (options) => {
  const { samConfig, samConfigEnv, debug } = options;

  if (debug) {
    console.debug(`SAM config file: ${samConfig}`);
    console.debug(`SAM config env: ${samConfigEnv}`);
  }

  getStackDetails(samConfig, samConfigEnv)
    .then((details) => getOutputs(details.stackName, details.region))
    .then((stackOutputs) => console.log(stackOutputs[output]));
};

const echoBucket = echoOutput("WebUIBucket");
const echoUrl = echoOutput("WebUrl");

const makeCommand = (name, desc, handler) =>
  program
    .command(name)
    .option(
      "-c, --sam-config <file>",
      "The SAM config toml file generated when deploying the solution",
      "samconfig.toml"
    )
    .option(
      "-e, --sam-config-env <env>",
      "The SAM environment to use to generate the config file",
      "default"
    )
    .option("-d, --debug", "Whether to debug")
    .description(desc)
    .action(handler);
makeCommand(
  "generate-config",
  "Generates a frontend configuration file for Microfrontend Version Management",
  generateConfig
);
makeCommand("echo-bucket", "Prints the frontend UI bucket name", echoBucket);
makeCommand("echo-url", "Prints the deployed frontend URL", echoUrl);

program.parse(process.argv);
