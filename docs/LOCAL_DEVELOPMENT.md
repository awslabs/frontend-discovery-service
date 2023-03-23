# Local Development

This section details how to run the solution locally and deploy your code
changes from the command line.

## Pre-Requisites

The following dependencies must be installed:

- AWS CLI (v1)
- Python >=3.9 and pip
- node.js >= v16.11 and npm >= 8
- virtualenv
- SAM CLI >= 1.73.0

Once you have installed all pre-requisites, you must run the following command
to create a `virtualenv` and install all the dependencies before
commencing development.

```bash
virtualenv venv
source venv/bin/activate
pip install pre-commit cfn-flip
venv/bin/pre-commit install
npm install
```

## Build and Deploy from Source

To deploy the solution manually from source to your AWS account, run the
following commands:

```bash
npm run deploy-guided
export STACK_NAME = <STACK NAME>
```

This will deploy the solution using the AWS SAM profile of the current shell. By default this will be the profile `default`.

#### Run Tests

> **Important**: Running acceptance tests requires the solution CloudFormation
> stack to be deployed. For more info, see
> [Build and Deploy From Source](#build-and-deploy-from-source)

The following commands are available for running tests:

- `npm test`: Run all unit and integration tests.
