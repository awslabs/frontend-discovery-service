<h1 align="center">
    Frontend Service Discovery on AWS
    <br>
    <img src="https://img.shields.io/github/v/release/awslabs/frontend-service-discovery?include_prereleases">
    <img src="https://github.com/awslabs/frontend-service-discovery/workflows/Unit%20Tests/badge.svg">
</h1>

Frontend Service Discovery on AWS is a solution to handle frontend releases on AWS using the [frontend discovery pattern](https://github.com/awslabs/frontend-discovery).

The frontend discovery pattern improves the development experience when developing, testing, and delivering micro-frontends by making use of a shareable configuration describing the entry point of micro-frontends, as well as additional metadata that is used to deploy in every environment safely using Canary Releases.

## Installation

The solution is available as an AWS CloudFormation template and should take
about 5 minutes to deploy. See the
[deployment guide](docs/USER_GUIDE.md#deploying-the-solution) for one-click
deployment instructions, and the [cost overview guide](docs/COST_OVERVIEW.md) to
learn about costs.

## Usage

The solution provides a REST API to allow you to integrate it in your own CI/CD pipelines, a well as a REST API to allow you to integrate the schema to your front-end applications.

See the [user guide](docs/USER_GUIDE.md) to learn how to use the solution and
the [API specification](docs/API.md) to integrate the solution with your
own applications. See the [examples](examples) to see some examples on how to integrate the Consumer API with your front-end application.

## Architecture

![Architecture Diagram](docs/images/architecture.png)

## Documentation

- [User Guide](docs/USER_GUIDE.md)
- [Deployment](docs/USER_GUIDE.md#deploying-the-solution)
- [Cost Overview](docs/COST_OVERVIEW.md)
- [API Specification](docs/API.md)
- [Local Development](docs/LOCAL_DEVELOPMENT.md)

## Contributing

Contributions are more than welcome. Please read the
[code of conduct](CODE_OF_CONDUCT.md) and the
[contributing guidelines](CONTRIBUTING.md).

## License Summary

This project is licensed under the Apache-2.0 License.
