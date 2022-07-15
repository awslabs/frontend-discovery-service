# Micro-Frontends discovery

**Feature Name:** MFE-Discovery

**Type:** Feature

**Start Date:** 2022-03-28

**Author:** Luca Mezzalira, Matteo Figus, Joel Denning, Zack Jackson

## Summary

The aim of this working group is creating a JSON schema describing the discoverability of client-side rendering (CSR) micro-frontends. The schema has to take into account not only the entry point of a micro-frontends but also additional deployment capabilities to increase the confidence of developers to deploy in every environment safely.

## Motivation

There are many client-side rendering frameworks and libraries for building micro-frontends such as Single SPA, Module Federation, Luigi Framework and more.  
They are all doing a great job composing micro-frontends in a single view (horizontal split) or as standalone artifact loaded by an application shell (vertical split), facilitating the development experience and provide utilities for overcoming common challenges during the development of a micro-frotnends application.
The only part not covered properly by any of these framework is the micro-frontends discoverability.  
In distributed architectures like microservices, we have mechanisms for consuming the endpoint of a specific service without the need to know exactly the URL. The [service discovery pattern](https://microservices.io/patterns/server-side-discovery.html) allows to associate an unique identifier to a URL that is managed by the service team who manage the service.  
In this way, the team can change the underline infrastructure and even the service URL, without the need to coordinate with all the consumer of their API. The service team is decoupled from the rest of the consumers and it has the capability to work autonomously reducing the time to market of their implementations.

This is a common challenge for distributed systems on the backend, but so far there isn't an alternative for distributed systems on the frontend.  
_That's the reason why we want to introduce a micro-frontends discovery pattern._
This gap in client-side rendering implementations is a common challenge for every micro-frontends application and every company is solving in different ways: injecting the URL during the CI pipeline, creating browsers extensions for allowing developers to quickly test their micro-frontends autonomously and so on.
However, we didn't find a consistent way to look at the problem that is not only enabling to retrieve the entry point of a micro-frontend but also improving the deployment process with mechanisms such as _canary release_, _blue-green deployment_ or _role-based deployment_.

After we solve this challenge, we will be able to create a foundational library in Vanilla JavaScript that abstracts the complexity and it is easily integrated with all the CSR micro-frontend frameworks.

## Detailed design

We identified in a JSON schema the possibility to remotely serve a catalog of endpoints representing the micro-frontends that compose a frontend distributed application.

The schema has to cover the following use cases:

- provide a list of micro-frontends entrypoint in form of URLs
- introduce deployment mechanisms such as canary releases and blue-green deployment for CSR applications
- cover a role-based release for all the applications that need to handle authorization access for every user
- allow extensibility for different use cases specific to company (e.g.: country-based deployment)

### Schema proposal

Basic schema with mandatory fields:

```
{
    "catalog": {
        "entryPoint": "http://localhost:3002/remoteEntry.js",
        "version": "0.0.1"
    }

    "customerSupport": [
        {
"           entryPoint": "http://localhost:3003/remoteEntry.js",
            "version": "1.0.0",
            "traffic": 30
        },
        {
            "entryPoint": "http://localhost:3004/remoteEntry.js",
            "version": "2.1.0",
            "traffic": 70
        }
    ]
}
```

**TODO: Describe fields**

Canary Release example:

```
{
    "customerSupport": [
        {
"           entryPoint": "http://localhost:3003/remoteEntry.js",
            "version": "1.0.0",
            "traffic": 30
        },
        {
            "entryPoint": "http://localhost:3004/remoteEntry.js",
            "version": "2.1.0",
            "traffic": 70
        }
    ]
}
```

**TODO: Describe fields**

Blue-Green Deployment example:

```
{
    "customerSupport": [
        {
"           entryPoint": "http://localhost:3003/remoteEntry.js",
            "version": "1.0.0",
            "traffic": 0
        },
        {
            "entryPoint": "http://localhost:3004/remoteEntry.js",
            "version": "2.1.0",
            "traffic": 1
        }
    ]
}
```

**TODO: Describe fields**

Role-based Deployment example:

```
{

}
```

**TODO: Describe fields**

## Drawbacks

I Why should we not do this?

## Alternatives

What other designs have been considered? What is the impact of not doing this?

## Unresolved questions

What parts of the design are still to be done?
