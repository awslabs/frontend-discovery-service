# Frontend Discovery

This repository contains schema, documentation and RFCs for the Frontend Discovery project.

## Summary

The aim of this project is to define and drive adoption of a frontend discovery pattern, with a primary focus on client-side rendered (CSR), server-side rendered (SSR) and edge-side rendered (ESR) micro-frontends.
The frontend discovery pattern improves the development experience when developing, testing, and delivering micro-frontends by making use of a shareable configuration describing the entry point of micro-frontends, as well as additional metadata that can be used to deploy in every environment safely.

### Motivation

There are many client-side rendering frameworks and libraries for building micro-frontends such as Single SPA, Module Federation, Luigi Framework and more.
They are all doing a great job composing micro-frontends in a single view (horizontal split) or as standalone artifact loaded by an application shell (vertical split), facilitating the development experience and provide utilities for overcoming common challenges during the development of a micro-frontends application. However, currently none of these frameworks address micro-frontends discoverability.
In distributed architectures like micro-services, there are mechanisms to consume a specific service without knowing its endpoint URL. The [service discovery pattern](https://microservices.io/patterns/server-side-discovery.html) allows to associate a unique identifier to a URL that is managed by the service team who manage the service.
In this way, the team can change the underline infrastructure and even the service URL, without the need to coordinate with all the consumer of their API. The service team is decoupled from the rest of the consumers and it has the capability to work autonomously reducing the time to market of their implementations.

This is a common challenge for distributed systems on the backend, but so far there isn't an alternative for distributed systems on the frontend. **That's the reason why we want to introduce a micro-frontends discovery pattern.**

This gap in client-side rendering implementations is a common challenge for every micro-frontends application and every company is solving in different ways: injecting the URL during the CI pipeline, creating browsers extensions for allowing developers to quickly test their micro-frontends autonomously and so on. However, we didn't find a consistent way to look at the problem that is not only enabling to retrieve the entry point of a micro-frontend but also improving the deployment process with mechanisms such as _canary release_, _blue-green deployment_ or _role-based deployment_.

The goal of this project is defining a the discoverability schema, and provide examples and foundational libraries in Vanilla JavaScript that can abstract the complexity and be easily integrated with all the most popular micro-frontend frameworks.

### Discoverability Schema

The schema covers the following use cases:

- provide a list of micro-frontends entrypoints in form of URLs
- introduce deployment mechanisms such as canary releases and blue-green deployment for applications
- allow extensibility for different use cases specific to company (e.g.: country-based deployment) and framework specific implementations

This is an example of the [latest schema implementation](schema/):

```json
{
  "schema": "https://mfewg.org/schema/v1-pre.json",
  "microFrontends": {
    "@my-project/catalog": [
      {
        "url": "https://static.website.com/my-catalog-1.3.5.js",
        "fallbackUrl": "https://alt-cdn.com/my-catalog-1.3.5.js",
        "metadata": {
          "integrity": "e0d123e5f316bef78bfdf5a008837577",
          "version": "1.3.5"
        },
        "extras": {
          "modulefederation": {
            "prefetch": ["@my-project/myaccount"]
          }
        }
      }
    ],
    "@my-project/myaccount": [
      {
        "url": "https://static.website.com/my-account-1.2.2.js",
        "fallbackUrl": "https://alt-cdn.com/my-account-1.2.2.js",
        "metadata": {
          "integrity": "e0d123e5f316bef78bfdf5a008837577",
          "version": "1.2.2"
        },
        "deployment": {
          "traffic": 30,
          "default": false
        }
      },
      {
        "url": "https://static.website.com/my-account-2.0.0.js",
        "fallbackUrl": "https://alt-cdn.com/my-account-2.0.0.js",
        "metadata": {
          "integrity": "e0d123e5f316bef78bfdf5a008837577",
          "version": "2.0.0"
        },
        "deployment": {
          "traffic": 70,
          "default": true
        }
      }
    ]
  }
}
```

## Roadmap

- March 2022 to April 2022: Formed a group of core contributors consisting of [Joel Denning](https://github.com/joeldenning), [Luca Mezzalira](https://github.com/lucamezzalira), [Matteo Figus](https://github.com/matteofigus) and [Zack Jackson](https://github.com/ScriptedAlchemy) and defined motivation and project goals
- April 2022 to June 2022: Worked on the [first candidate for the discovery Schema](schema/v1-pre.json)
- August 2022: Open Github Repository for public consumption, discussion and allow creation of RFCs
- Q4 2022 until Q1 2023: Creation of JavaScript Vanilla Library and Framework specific POCs to validate schema v1 candidate, add documentation, add code examples and iterate on schema after gathering feedback from community

## Contributing with RFCs

### What is an RFC?

An RFC is a document that proposes a change to the project. _Request for Comments_ means a request for discussion and oversight about the future of the project from maintainers, contributors and users.

### RFC Process

This team is still defining the best process to work on RFCs. For the time being, everyone can create an RFC proposal about the project, the JSON schema and the roadmap by opening an Issue in Github.

### Security issue notifications

If you discover a potential security issue in this project we ask that you
notify AWS/Amazon Security via our
[vulnerability reporting page](http://aws.amazon.com/security/vulnerability-reporting/).
Please do **not** create a public github issue.

### Licensing

See the
[LICENSE](LICENSE)
file for our project's licensing. We will ask you to confirm the licensing of
your contribution.

We may ask you to sign a
[Contributor License Agreement (CLA)](http://en.wikipedia.org/wiki/Contributor_License_Agreement)
for larger changes.
