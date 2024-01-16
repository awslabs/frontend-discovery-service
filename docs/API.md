# API

This solution contains two APIs:

- Admin API - Used to manage releases for MicroFrontends. The API endpoints are authorized by Cognito.
- Consumer API - Used to retrieve endpoints and metadata for MicroFrontends. The API has no authorizer configured.

## Admin API

Listed below are the endpoints for this API. Requests must be signed with credentials retrieved from Cognito. Where the request takes a body, refer to the [JSON Schema](../infrastructure/lambda/adminApi/inputSchemas.js) for more information.

The endpoint for this API can be retrieved from the CloudFormation output `AdminApi` after you have deployed the solution.

---
```GET	/projects```

Gets a list of projects

Example Response:

```json
{
    "projects": [
        {
            "id": "ccc1673f-02aa-48cd-b82a-a7911e7150ab",
            "name": "my-project"
        }
    ]
}
```
---
```POST	/projects```

Adds a new project

Example Request:

```json
{
    "name": "new-project"
}
```

Example Response:

```json
{
    "id": "a9b250ad-ec75-4883-9a66-42239be3b390",
    "name": "new-project"
}
```
---
```PATCH	/projects/{projectId}```

Updates an existing project

Example Request:

```json
{
    "name": "updated-name"
}
```

Example Response:

```json
{
    "id": "a9b250ad-ec75-4883-9a66-42239be3b390",
    "name": "updated-name"
}
```

---

```DELETE	/projects/{projectId}```

Deletes a project

---

```GET	/projects/{projectId}/microFrontends```

Get a list of existing MicroFrontends

Example Response:

```json
{
    "projectId": "ccc1673f-02aa-48cd-b82a-a7911e7150ab",
    "microFrontends": [
        {
            "name": "my-project/catalog-123",
            "id": "27a7928f-9ae2-4f6a-bc51-8478c91f7517",
            "activeVersions": [
                {
                    "traffic": 100,
                    "version": "2.0.0"
                }
            ]
        }
    ]
}
```

---

```POST	/projects/{projectId}/microFrontends```

Adds a new MicroFrontend

Example Request:

```json
{
    "name": "new-mfe"
}
```

Example Response:

```json
{
    "microFrontendId": "35bc405b-c61f-4c1f-b0c9-5c1acf84edb4",
    "name": "new-mfe"
}
```

---

```PATCH	/projects/{projectId}/microFrontends/{microFrontendId}```

Updates an existing MicroFrontend. This could be a renaming a MicroFrontend, or updating the version information. In the latter case, this can only be done when no deployment is in progress.

Example Request:

```json
{
    "name": "updated-mfe",
    "activeVersions": [
        {
            "version": "1.0.0",
            "traffic": 100
        }
    ],
    "default": "1.0.0"
}
```

Example Response:

```json
{
    "microFrontendId": "35bc405b-c61f-4c1f-b0c9-5c1acf84edb4",
    "name": "updated-mfe",
    "activeVersions": [
        {
            "version": "1.0.0",
            "traffic": 100
        }
    ],
    "default": "1.0.0"
}
```

---

```DELETE	/projects/{projectId}/microFrontends/{microFrontendId}```

Deletes a MicroFrontend

---

```GET	/projects/{projectId}/microFrontends/{microFrontendId}/versions	```

Retrieves a list of versions for a given MicroFrontend

Example Response:

```json
{
    "projectId": "ccc1673f-02aa-48cd-b82a-a7911e7150ab",
    "microFrontendId": "27a7928f-9ae2-4f6a-bc51-8478c91f7517",
    "activeVersions": [
        {
            "traffic": 100,
            "version": "2.0.0"
        }
    ],
    "versions": [
        {
            "url": "https://static.example.com/my-account-1.0.0.js",
            "metadata": {
                "version": "1.0.0",
                "integrity": "e0d123e5f316bef78bfdf5a008837577"
            },
            "fallbackUrl": "https://alt-cdn.com/my-account-1.0.0.js"
        },
        {
            "url": "https://static.example.com/my-account-2.0.0.js",
            "metadata": {
                "version": "2.0.0",
                "integrity": "e0d123e5f316bef78bfdf5a008837600"
            },
            "fallbackUrl": "https://alt-cdn.com/my-account-2.0.0.js"
        }
    ],
    "name": "my-project-123/catalog-123"
}
```

---

```POST	/projects/{projectId}/microFrontends/{microFrontendId}/versions	```

Adds a new version for a MicroFrontend. Optionally initiates a deployment if a strategy is specified. Available strategies are detailed in the [JSON Schema](../infrastructure/lambda/adminApi/inputSchemas.js).

Example Request:

```json
{
    "version": {
        "url": "https://static.example.com/my-account-4.0.0.js",
        "metadata": {
            "version": "4.0.0",
            "integrity": "e0d123e5f317bef78bfdf5a008837200"
        },
        "fallbackUrl": "https://alt-cdn.com/my-account-4.0.0.js"
    },
    "deploymentStrategy": "Canary10Percent5Minutes"
}

```

Example Response:

```json
{
    "microFrontendId": "27a7928f-9ae2-4f6a-bc51-8478c91f7517",
    "version": {
        "url": "https://static.example.com/my-account-4.0.0.js",
        "metadata": {
            "version": "4.0.0",
            "integrity": "e0d123e5f317bef78bfdf5a008837200"
        },
        "fallbackUrl": "https://alt-cdn.com/my-account-4.0.0.js"
    },
    "deploymentId": "0d6af278-0cff-42a1-b283-161fe9a3119b"
}
```

Note: When adding the first MicroFrontend version, the "deploymentStrategy" property must be omitted from the payload.



---
```POST	/projects/{projectId}/microFrontends/{microFrontendId}/deployment	```

Initiates a new deployment using the specified strategy. Available strategies are detailed in the [JSON Schema](../infrastructure/lambda/adminApi/inputSchemas.js).

Example Request:

```json
{
    "targetVersion": "2.0.0",
    "deploymentStrategy": "Linear10PercentEvery1Minute"
}

```

Example Response:

```json
{
    "deploymentId": "40ad2d79-3ba4-4c47-b76f-60c14a58ce19"
}
```

---

```DELETE	/projects/{projectId}/microFrontends/{microFrontendId}/deployment/{deploymentId}```

Cancels an ongoing deployment



## Consumer API

Listed below are the endpoints for this API. The endpoint for this API can be retrieved from the CloudFormation output `ConsumerApi` after you have deployed the solution.

---

```GET	/projects/{projectId}/microFrontends```

Gets a list of MicroFrontend endpoints

Example Response:

```json
{
    "schema": "https://raw.githubusercontent.com/awslabs/frontend-discovery/main/schema/v1-pre.json",
    "microFrontends": {
        "my-project-123/catalog-123": [
            {
                "metadata": {
                    "version": "4.0.0",
                    "integrity": "e0d123e5f317bef78bfdf5a008837200"
                },
                "fallbackUrl": "https://alt-cdn.com/my-account-4.0.0.js",
                "url": "https://static.example.com/my-account-4.0.0.js"
            }
        ]
    }
}
```
