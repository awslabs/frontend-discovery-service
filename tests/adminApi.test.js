import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
  PutCommand,
  BatchWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  SFNClient,
  StartExecutionCommand,
  StopExecutionCommand,
} from "@aws-sdk/client-sfn";
import { v4 as uuidv4 } from "uuid";

jest.mock("uuid");
const ddbMock = mockClient(DynamoDBDocumentClient);
const sfnMock = mockClient(SFNClient);

import {
  getProjectsApi,
  postProjectsApi,
  getFrontendsApi,
  getFrontendVersionsApi,
  deleteProjectApi,
  postMFEApi,
  postFrontendVersionApi,
  postDeploymentApi,
  patchProjectApi,
  patchMFEApi,
  checkCanDeploy,
  deleteMicroFrontendApi,
  deleteDeploymentApi,
} from "../infrastructure/lambda/adminApi/app";

const uuidStub = "81149c12-8c00-4ec2-9c03-cca5f1def455";
process.env.FRONTEND_STORE = "frontend";
process.env.PROJECT_STORE = "project";
process.env.VERSION_STORE = "version";
process.env.DEPLOYMENT_STORE = "myTable2";

const projectStub = require("./stubs/project.json");
const mfeStub = require("./stubs/mfe.json");
const mfeWithDeploymentStub = require("./stubs/mfeWithDeployment.json");
const versionsStub = require("./stubs/versions.json");
const deploymentStub = require("./stubs/deployment.json");

describe("Admin Api", () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  test("it gets a list of projects", async () => {
    ddbMock
      .on(ScanCommand, {
        TableName: process.env.PROJECT_STORE,
      })
      .resolves({ Items: [projectStub] });

    const result = await getProjectsApi({}, {});
    const body = JSON.parse(result.body);

    expect(body).toStrictEqual({
      projects: [
        {
          id: projectStub.projectId,
          name: projectStub.name,
        },
      ],
    });
    expect(result.statusCode).toBe(200);
  });

  test("it gets a list of projects and indicates deleted projects", async () => {
    ddbMock
      .on(ScanCommand, {
        TableName: process.env.PROJECT_STORE,
      })
      .resolves({ Items: [{ ...projectStub, ...{ deleted: true } }] });

    const result = await getProjectsApi({}, {});
    const body = JSON.parse(result.body);

    expect(body).toStrictEqual({
      projects: [
        {
          id: projectStub.projectId,
          name: projectStub.name,
          deleted: true,
        },
      ],
    });
    expect(result.statusCode).toBe(200);
  });

  test("it creates a new project", async () => {
    uuidv4.mockReturnValueOnce(uuidStub);

    const event = {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectStub.name }),
    };
    const result = await postProjectsApi(event, {});
    const body = JSON.parse(result.body);

    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: process.env.PROJECT_STORE,
      Item: {
        projectId: uuidStub,
        name: projectStub.name,
      },
    });
    expect(body).toStrictEqual({ id: uuidStub, name: projectStub.name });
    expect(result.statusCode).toBe(201);
  });

  test("it throws if body is invalid when creating a project", async () => {
    try {
      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      };
      await postProjectsApi(event, {});
      throw new Error("The test should have raised another error");
    } catch (error) {
      expect(error).toHaveProperty("message", "Event object failed validation");
      expect(error).toHaveProperty("statusCode", 400);
    }
  });

  test("it renames an existing project", async () => {
    ddbMock
      .on(QueryCommand, {
        KeyConditionExpression: "projectId = :project",
        ExpressionAttributeValues: {
          ":project": projectStub.projectId,
        },
        TableName: process.env.PROJECT_STORE,
      })
      .resolves({ Items: [projectStub] });

    const newProjectName = "renamed-projct";
    const event = {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProjectName }),
      pathParameters: { projectId: projectStub.projectId },
    };
    const result = await patchProjectApi(event, {});
    const body = JSON.parse(result.body);

    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: process.env.PROJECT_STORE,
      Item: {
        projectId: projectStub.projectId,
        name: newProjectName,
      },
    });
    expect(body).toStrictEqual({
      id: projectStub.projectId,
      name: newProjectName,
    });
    expect(result.statusCode).toBe(200);
  });

  test("it throws when patching a project that is deleted", async () => {
    try {
      ddbMock
        .on(QueryCommand, {
          KeyConditionExpression: "projectId = :project",
          ExpressionAttributeValues: {
            ":project": projectStub.projectId,
          },
          TableName: process.env.PROJECT_STORE,
        })
        .resolves({ Items: [{ ...projectStub, ...{ deleted: true } }] });

      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "a name" }),
        pathParameters: { projectId: projectStub.projectId },
      };

      await patchProjectApi(event, {});
      fail("it should not reach here");
    } catch (error) {
      expect(error.statusCode).toBe(404);
    }
  });

  test("it throws if body is invalid when renaming a project", async () => {
    try {
      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      };
      await patchProjectApi(event, {});
      fail("it should not reach here");
    } catch (error) {
      expect(error.message).toBe("Event object failed validation");
      expect(error.statusCode).toBe(400);
    }
  });

  test("it gets project frontends", async () => {
    ddbMock
      .on(QueryCommand, {
        KeyConditionExpression: "projectId = :project",
        ExpressionAttributeValues: {
          ":project": projectStub.projectId,
        },
        TableName: process.env.PROJECT_STORE,
      })
      .resolves({ Items: [projectStub] })
      .on(QueryCommand, {
        KeyConditionExpression: "projectId = :project",
        ExpressionAttributeValues: {
          ":project": projectStub.projectId,
        },
        TableName: process.env.FRONTEND_STORE,
      })
      .resolves({ Items: [mfeStub] });

    const event = {
      pathParameters: { projectId: projectStub.projectId },
    };
    const result = await getFrontendsApi(event, {});
    const body = JSON.parse(result.body);

    expect(body).toStrictEqual({
      projectId: projectStub.projectId,
      microFrontends: [
        {
          name: `${projectStub.name}/${mfeStub.name}`,
          id: mfeStub.microFrontendId,
          activeVersions: mfeStub.activeVersions,
        },
      ],
    });
    expect(result.statusCode).toBe(200);
  });

  test("it gets project frontends and indicates deleted entries", async () => {
    ddbMock
      .on(QueryCommand, {
        KeyConditionExpression: "projectId = :project",
        ExpressionAttributeValues: {
          ":project": projectStub.projectId,
        },
        TableName: process.env.PROJECT_STORE,
      })
      .resolves({ Items: [projectStub] })
      .on(QueryCommand, {
        KeyConditionExpression: "projectId = :project",
        ExpressionAttributeValues: {
          ":project": projectStub.projectId,
        },
        TableName: process.env.FRONTEND_STORE,
      })
      .resolves({ Items: [{ ...mfeStub, ...{ deleted: true } }] });

    const event = {
      pathParameters: { projectId: projectStub.projectId },
    };
    const result = await getFrontendsApi(event, {});
    const body = JSON.parse(result.body);

    expect(body).toStrictEqual({
      projectId: projectStub.projectId,
      microFrontends: [
        {
          name: `${projectStub.name}/${mfeStub.name}`,
          id: mfeStub.microFrontendId,
          activeVersions: mfeStub.activeVersions,
          deleted: true,
        },
      ],
    });
    expect(result.statusCode).toBe(200);
  });

  test("it gets versions for a given frontend", async () => {
    ddbMock
      .on(QueryCommand, {
        KeyConditionExpression: "projectId = :project",
        ExpressionAttributeValues: {
          ":project": projectStub.projectId,
        },
        TableName: process.env.PROJECT_STORE,
      })
      .resolves({ Items: [projectStub] })
      .on(QueryCommand, {
        KeyConditionExpression:
          "projectId = :project And microFrontendId = :microFrontendId",
        ExpressionAttributeValues: {
          ":project": projectStub.projectId,
          ":microFrontendId": mfeStub.microFrontendId,
        },
        TableName: process.env.FRONTEND_STORE,
      })
      .resolves({ Items: [mfeStub] })
      .on(QueryCommand, {
        KeyConditionExpression: "microFrontendId = :microFrontendId",
        ExpressionAttributeValues: {
          ":microFrontendId": mfeStub.microFrontendId,
        },
        TableName: process.env.VERSION_STORE,
      })
      .resolves(versionsStub);

    const event = {
      pathParameters: {
        projectId: projectStub.projectId,
        microFrontendId: mfeStub.microFrontendId,
      },
    };
    const result = await getFrontendVersionsApi(event, {});
    const body = JSON.parse(result.body);

    expect(body).toStrictEqual({
      projectId: projectStub.projectId,
      name: `${projectStub.name}/${mfeStub.name}`,
      microFrontendId: event.pathParameters.microFrontendId,
      activeVersions: mfeStub.activeVersions,
      versions: versionsStub.Items.map((v) => v.data),
    });
    expect(result.statusCode).toBe(200);
  });

  test("it throws if mfe does not exist when querying versions", async () => {
    try {
      const badMfeId = "doesnotexist";
      ddbMock
        .on(QueryCommand, {
          KeyConditionExpression: "projectId = :project",
          ExpressionAttributeValues: {
            ":project": projectStub.projectId,
          },
          TableName: process.env.PROJECT_STORE,
        })
        .resolves({ Items: [projectStub] })
        .on(QueryCommand, {
          KeyConditionExpression:
            "projectId = :project And microFrontendId = :microFrontendId",
          ExpressionAttributeValues: {
            ":project": projectStub.projectId,
            ":microFrontendId": badMfeId,
          },
          TableName: process.env.FRONTEND_STORE,
        })
        .resolves({ Items: [] });

      const event = {
        pathParameters: {
          projectId: projectStub.projectId,
          microFrontendId: badMfeId,
        },
      };
      await getFrontendVersionsApi(event, {});
      fail("it should not reach here");
    } catch (error) {
      expect(error.message).toBe("Not Found");
      expect(error.statusCode).toBe(404);
    }
  });

  test("it deletes a project", async () => {
    const event = {
      pathParameters: { projectId: projectStub.projectId },
    };
    const result = await deleteProjectApi(event, {});

    expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
      ExpressionAttributeValues: {
        ":d": true,
        ":e": expect.any(Number),
        ":p": projectStub.projectId,
      },
      Key: { projectId: projectStub.projectId },
      TableName: process.env.PROJECT_STORE,
      UpdateExpression: "set deleted = :d, expiresAt = :e",
      ConditionExpression: "projectId = :p",
    });
    expect(result.statusCode).toBe(202);
  });

  test("it throws if deleting a non existent project", async () => {
    const event = {
      pathParameters: { projectId: projectStub.projectId },
    };
    ddbMock
      .on(UpdateCommand)
      .rejectsOnce({ name: "ConditionalCheckFailedException" });

    const result = await deleteProjectApi(event, {});

    expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
      ExpressionAttributeValues: {
        ":d": true,
        ":e": expect.any(Number),
        ":p": projectStub.projectId,
      },
      Key: { projectId: projectStub.projectId },
      TableName: process.env.PROJECT_STORE,
      UpdateExpression: "set deleted = :d, expiresAt = :e",
      ConditionExpression: "projectId = :p",
    });
    expect(result.statusCode).toBe(404);
  });

  test("it creates a new frontend", async () => {
    uuidv4.mockReturnValueOnce(uuidStub);

    const event = {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: mfeStub.name }),
      pathParameters: { projectId: projectStub.projectId },
    };
    const result = await postMFEApi(event, {});
    const body = JSON.parse(result.body);

    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: process.env.FRONTEND_STORE,
      Item: {
        projectId: projectStub.projectId,
        microFrontendId: uuidStub,
        name: mfeStub.name,
        activeVersions: [],
      },
    });
    expect(body).toStrictEqual({
      microFrontendId: uuidStub,
      name: mfeStub.name,
    });
    expect(result.statusCode).toBe(201);
  });

  test("it deletes a frontend", async () => {
    const event = {
      pathParameters: {
        projectId: projectStub.projectId,
        microFrontendId: mfeStub.microFrontendId,
      },
    };
    const result = await deleteMicroFrontendApi(event, {});

    expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
      ExpressionAttributeValues: {
        ":d": true,
        ":e": expect.any(Number),
        ":p": projectStub.projectId,
        ":m": mfeStub.microFrontendId,
      },
      Key: {
        projectId: projectStub.projectId,
        microFrontendId: mfeStub.microFrontendId,
      },
      TableName: process.env.FRONTEND_STORE,
      UpdateExpression: "set deleted = :d, expiresAt = :e",
      ConditionExpression: "projectId = :p and microFrontendId = :m",
    });
    expect(result.statusCode).toBe(202);
  });

  test("it throws if deleting a non existent frontend", async () => {
    const event = {
      pathParameters: {
        projectId: projectStub.projectId,
        microFrontendId: mfeStub.microFrontendId,
      },
    };
    ddbMock
      .on(UpdateCommand)
      .rejectsOnce({ name: "ConditionalCheckFailedException" });

    const result = await deleteMicroFrontendApi(event, {});

    expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
      ExpressionAttributeValues: {
        ":d": true,
        ":e": expect.any(Number),
        ":p": projectStub.projectId,
        ":m": mfeStub.microFrontendId,
      },
      Key: {
        projectId: projectStub.projectId,
        microFrontendId: mfeStub.microFrontendId,
      },
      TableName: process.env.FRONTEND_STORE,
      UpdateExpression: "set deleted = :d, expiresAt = :e",
      ConditionExpression: "projectId = :p and microFrontendId = :m",
    });
    expect(result.statusCode).toBe(404);
  });

  test("it updates an existing frontend", async () => {
    const newMfeName = "my-new-mfe-name";

    ddbMock
      .on(QueryCommand, {
        KeyConditionExpression:
          "projectId = :project And microFrontendId = :microFrontendId",
        ExpressionAttributeValues: {
          ":project": projectStub.projectId,
          ":microFrontendId": mfeStub.microFrontendId,
        },
        TableName: process.env.FRONTEND_STORE,
      })
      .resolves({ Items: [mfeStub] });

    const event = {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newMfeName }),
      pathParameters: {
        projectId: projectStub.projectId,
        microFrontendId: mfeStub.microFrontendId,
      },
    };

    const result = await patchMFEApi(event, {});
    const body = JSON.parse(result.body);

    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: process.env.FRONTEND_STORE,
      Item: {
        projectId: projectStub.projectId,
        microFrontendId: mfeStub.microFrontendId,
        name: newMfeName,
        default: mfeStub.default,
        activeVersions: mfeStub.activeVersions,
      },
    });
    expect(body).toStrictEqual({
      microFrontendId: mfeStub.microFrontendId,
      name: newMfeName,
      activeVersions: mfeStub.activeVersions,
      default: mfeStub.default,
    });
    expect(result.statusCode).toBe(200);
  });

  test("it throws when patching a microfrontend that is deleted", async () => {
    try {
      ddbMock
        .on(QueryCommand, {
          KeyConditionExpression:
            "projectId = :project And microFrontendId = :microFrontendId",
          ExpressionAttributeValues: {
            ":project": projectStub.projectId,
            ":microFrontendId": mfeStub.microFrontendId,
          },
          TableName: process.env.FRONTEND_STORE,
        })
        .resolves({ Items: [{ ...mfeStub, ...{ deleted: true } }] });

      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "a name" }),
        pathParameters: {
          projectId: projectStub.projectId,
          microFrontendId: mfeStub.microFrontendId,
        },
      };

      const result = await patchMFEApi(event, {});
      fail("it should not reach here");
    } catch (error) {
      expect(error.statusCode).toBe(404);
    }
  });

  test("it throws if specified default not in active versions when patching an mfe", async () => {
    try {
      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default: "9.0.0" }),
        pathParameters: {
          projectId: projectStub.projectId,
          microFrontendId: mfeStub.microFrontendId,
        },
      };

      ddbMock
        .on(QueryCommand, {
          KeyConditionExpression:
            "projectId = :project And microFrontendId = :microFrontendId",
          ExpressionAttributeValues: {
            ":project": projectStub.projectId,
            ":microFrontendId": mfeStub.microFrontendId,
          },
          TableName: process.env.FRONTEND_STORE,
        })
        .resolves({ Items: [mfeStub] });

      const result = await patchMFEApi(event, {});
      fail("it should not reach here");
    } catch (error) {
      expect(error.message).toBe(
        "The configured default is not one of the active versions."
      );
      expect(error.statusCode).toBe(422);
    }
  });

  test("it posts a new frontend version without deployment", async () => {
    ddbMock
      .on(QueryCommand, {
        KeyConditionExpression:
          "projectId = :project And microFrontendId = :microFrontendId",
        ExpressionAttributeValues: {
          ":project": projectStub.projectId,
          ":microFrontendId": mfeStub.microFrontendId,
        },
        TableName: process.env.FRONTEND_STORE,
      })
      .resolves({ Items: [mfeStub] });

    const newVersion = {
      fallbackUrl: "https://alt-cdn.com/my-account-3.0.0.js",
      metadata: {
        integrity: "e0d123e5f316bef78bfdf5a008837999",
        version: "3.0.0",
      },
      url: "https://static.example.com/my-account-3.0.0.js",
    };

    const event = {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: newVersion }),
      pathParameters: {
        projectId: projectStub.projectId,
        microFrontendId: mfeStub.microFrontendId,
      },
    };
    const result = await postFrontendVersionApi(event, {});
    const body = JSON.parse(result.body);

    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: process.env.VERSION_STORE,
      Item: {
        microFrontendId: mfeStub.microFrontendId,
        version: newVersion.metadata.version,
        data: newVersion,
      },
    });
    expect(body).toStrictEqual({
      microFrontendId: mfeStub.microFrontendId,
      version: newVersion,
    });
    expect(result.statusCode).toBe(201);
  });

  test("it posts a new frontend version with deployment", async () => {
    uuidv4.mockReturnValueOnce(uuidStub);
    ddbMock
      .on(QueryCommand, {
        KeyConditionExpression:
          "projectId = :project And microFrontendId = :microFrontendId",
        ExpressionAttributeValues: {
          ":project": projectStub.projectId,
          ":microFrontendId": mfeStub.microFrontendId,
        },
        TableName: process.env.FRONTEND_STORE,
      })
      .resolves({ Items: [mfeStub] });

    const newVersion = {
      fallbackUrl: "https://alt-cdn.com/my-account-3.0.0.js",
      metadata: {
        integrity: "e0d123e5f316bef78bfdf5a008837999",
        version: "3.0.0",
      },
      url: "https://static.example.com/my-account-3.0.0.js",
    };

    const event = {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: newVersion,
        deploymentStrategy: "Canary10Percent5Minutes",
      }),
      pathParameters: {
        projectId: projectStub.projectId,
        microFrontendId: mfeStub.microFrontendId,
      },
    };
    const result = await postFrontendVersionApi(event, {});
    const body = JSON.parse(result.body);

    expect(ddbMock).toHaveReceivedCommand(BatchWriteCommand);
    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: process.env.VERSION_STORE,
      Item: {
        microFrontendId: mfeStub.microFrontendId,
        version: newVersion.metadata.version,
        data: newVersion,
      },
    });
    expect(body).toStrictEqual({
      microFrontendId: mfeStub.microFrontendId,
      version: newVersion,
      deploymentId: uuidStub,
    });
    expect(result.statusCode).toBe(201);
  });

  test("it throws if a microfrontend is deleted when posting a version", async () => {
    try {
      ddbMock
        .on(QueryCommand, {
          KeyConditionExpression:
            "projectId = :project And microFrontendId = :microFrontendId",
          ExpressionAttributeValues: {
            ":project": projectStub.projectId,
            ":microFrontendId": mfeStub.microFrontendId,
          },
          TableName: process.env.FRONTEND_STORE,
        })
        .resolves({ Items: [{ ...mfeStub, ...{ deleted: true } }] });

      const newVersion = {
        fallbackUrl: "https://alt-cdn.com/my-account-3.0.0.js",
        metadata: {
          integrity: "e0d123e5f316bef78bfdf5a008837999",
          version: "3.0.0",
        },
        url: "https://static.example.com/my-account-3.0.0.js",
      };

      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: newVersion,
        }),
        pathParameters: {
          projectId: projectStub.projectId,
          microFrontendId: mfeStub.microFrontendId,
        },
      };
      const result = await postFrontendVersionApi(event, {});
      fail("it should not reach here");
    } catch (error) {
      expect(error.statusCode).toBe(404);
    }
  });

  test("it throws if body is invalid when posting a frontend version", async () => {
    try {
      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      };
      await postFrontendVersionApi(event, {});
      fail("it should not reach here");
    } catch (error) {
      expect(error.message).toBe("Event object failed validation");
      expect(error.statusCode).toBe(400);
    }
  });

  test("it throws if there is an existing deployment when attempting a new deployment", async () => {
    try {
      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      };
      await checkCanDeploy({ deploymentId: 123 });
      fail("it should not reach here");
    } catch (error) {
      expect(error.message).toBe("There is an existing automated deployment.");
      expect(error.statusCode).toBe(422);
    }
  });

  test("it throws if there are multiple active versions when attempting a new deployment", async () => {
    try {
      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      };
      await checkCanDeploy({
        activeVersions: [
          {
            version: "1.2.2",
            traffic: 70,
          },
          {
            version: "2.0.0",
            traffic: 30,
          },
        ],
      });
      fail("it should not reach here");
    } catch (error) {
      expect(error.message).toBe(
        "Unable to create deployment when no existing version is currently receiving 100% traffic."
      );
      expect(error.statusCode).toBe(422);
    }
  });

  test("it throws if the target version is already the current version when attempting a deployment", async () => {
    try {
      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      };
      await checkCanDeploy(
        {
          activeVersions: [
            {
              version: "1.2.2",
              traffic: 100,
            },
          ],
        },
        "1.2.2"
      );
      fail("it should not reach here");
    } catch (error) {
      expect(error.message).toBe(
        "The target version is already the active version."
      );
      expect(error.statusCode).toBe(422);
    }
  });

  test("it throws if the target version does not exist when attempting a deployment", async () => {
    try {
      ddbMock
        .on(QueryCommand, {
          KeyConditionExpression:
            "microFrontendId = :microFrontendId And version = :v",
          ExpressionAttributeValues: {
            ":microFrontendId": mfeStub.microFrontendId,
            ":v": "2.0.0",
          },
          TableName: process.env.VERSION_STORE,
        })
        .resolves({ Items: [] });

      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      };
      await checkCanDeploy(mfeStub, "2.0.0");
      fail("it should not reach here");
    } catch (error) {
      expect(error.message).toBe("The specified version could not be found.");
      expect(error.statusCode).toBe(404);
    }
  });

  test("it posts a new deployment", async () => {
    uuidv4.mockReturnValueOnce(uuidStub);
    const targetVersion = "2.0.0";
    ddbMock
      .on(QueryCommand, {
        KeyConditionExpression:
          "projectId = :project And microFrontendId = :microFrontendId",
        ExpressionAttributeValues: {
          ":project": projectStub.projectId,
          ":microFrontendId": mfeStub.microFrontendId,
        },
        TableName: process.env.FRONTEND_STORE,
      })
      .resolves({ Items: [mfeStub] })
      .on(QueryCommand, {
        KeyConditionExpression:
          "microFrontendId = :microFrontendId And version = :v",
        ExpressionAttributeValues: {
          ":microFrontendId": mfeStub.microFrontendId,
          ":v": targetVersion,
        },
        TableName: process.env.VERSION_STORE,
      })
      .resolves({ Items: [{}] });

    const event = {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetVersion: targetVersion,
        deploymentStrategy: "Linear10PercentEvery1Minute",
      }),
      pathParameters: {
        projectId: projectStub.projectId,
        microFrontendId: mfeStub.microFrontendId,
      },
    };
    const result = await postDeploymentApi(event, {});
    const body = JSON.parse(result.body);

    expect(ddbMock).toHaveReceivedCommand(BatchWriteCommand);
    expect(sfnMock).toHaveReceivedCommand(StartExecutionCommand);
    expect(body).toStrictEqual({ deploymentId: uuidStub });
    expect(result.statusCode).toBe(201);
  });

  test("it throws if body is invalid when posting a deployment", async () => {
    try {
      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      };
      await postDeploymentApi(event, {});
      fail("it should not reach here");
    } catch (error) {
      expect(error.message).toBe("Event object failed validation");
      expect(error.statusCode).toBe(400);
    }
  });

  test("it throws if the microfrontend is deleted when posting a deployment", async () => {
    try {
      const targetVersion = "2.0.0";
      ddbMock
        .on(QueryCommand, {
          KeyConditionExpression:
            "projectId = :project And microFrontendId = :microFrontendId",
          ExpressionAttributeValues: {
            ":project": projectStub.projectId,
            ":microFrontendId": mfeStub.microFrontendId,
          },
          TableName: process.env.FRONTEND_STORE,
        })
        .resolves({ Items: [{ ...mfeStub, ...{ deleted: true } }] });

      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetVersion: targetVersion,
          deploymentStrategy: "Linear10PercentEvery1Minute",
        }),
        pathParameters: {
          projectId: projectStub.projectId,
          microFrontendId: mfeStub.microFrontendId,
        },
      };
      await postDeploymentApi(event, {});
      fail("it should not reach here");
    } catch (error) {
      expect(error.statusCode).toBe(404);
    }
  });

  test("it throws if there is an existing deployment when posting a deployment", async () => {
    try {
      const targetVersion = "2.0.0";
      ddbMock
        .on(QueryCommand, {
          KeyConditionExpression:
            "projectId = :project And microFrontendId = :microFrontendId",
          ExpressionAttributeValues: {
            ":project": projectStub.projectId,
            ":microFrontendId": mfeStub.microFrontendId,
          },
          TableName: process.env.FRONTEND_STORE,
        })
        .resolves({ Items: [{ deploymentId: "123" }] })
        .on(QueryCommand, {
          KeyConditionExpression:
            "microFrontendId = :microFrontendId And version = :v",
          ExpressionAttributeValues: {
            ":microFrontendId": mfeStub.microFrontendId,
            ":v": targetVersion,
          },
          TableName: process.env.VERSION_STORE,
        })
        .resolves({ Items: [{}] });

      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetVersion: targetVersion,
          deploymentStrategy: "Linear10PercentEvery1Minute",
        }),
        pathParameters: {
          projectId: projectStub.projectId,
          microFrontendId: mfeStub.microFrontendId,
        },
      };
      await postDeploymentApi(event, {});
      fail("it should not reach here");
    } catch (error) {
      expect(error.message).toBe("There is an existing automated deployment.");
      expect(error.statusCode).toBe(422);
    }
  });

  test("it throws if multiple versions are receiving traffic when posting a deployment", async () => {
    try {
      const targetVersion = "2.0.0";
      ddbMock
        .on(QueryCommand, {
          KeyConditionExpression:
            "projectId = :project And microFrontendId = :microFrontendId",
          ExpressionAttributeValues: {
            ":project": projectStub.projectId,
            ":microFrontendId": mfeStub.microFrontendId,
          },
          TableName: process.env.FRONTEND_STORE,
        })
        .resolves({ Items: [mfeWithDeploymentStub] })
        .on(QueryCommand, {
          KeyConditionExpression:
            "microFrontendId = :microFrontendId And version = :v",
          ExpressionAttributeValues: {
            ":microFrontendId": mfeStub.microFrontendId,
            ":v": targetVersion,
          },
          TableName: process.env.VERSION_STORE,
        })
        .resolves({ Items: [{}] });

      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetVersion: targetVersion,
          deploymentStrategy: "Linear10PercentEvery1Minute",
        }),
        pathParameters: {
          projectId: projectStub.projectId,
          microFrontendId: mfeStub.microFrontendId,
        },
      };
      await postDeploymentApi(event, {});
      fail("it should not reach here");
    } catch (error) {
      expect(error.message).toBe(
        "Unable to create deployment when no existing version is currently receiving 100% traffic."
      );
      expect(error.statusCode).toBe(422);
    }
  });

  test("it throws if the target version is already active when posting a deployment", async () => {
    try {
      const targetVersion = "1.2.2";
      ddbMock
        .on(QueryCommand, {
          KeyConditionExpression:
            "projectId = :project And microFrontendId = :microFrontendId",
          ExpressionAttributeValues: {
            ":project": projectStub.projectId,
            ":microFrontendId": mfeStub.microFrontendId,
          },
          TableName: process.env.FRONTEND_STORE,
        })
        .resolves({ Items: [mfeStub] })
        .on(QueryCommand, {
          KeyConditionExpression:
            "microFrontendId = :microFrontendId And version = :v",
          ExpressionAttributeValues: {
            ":microFrontendId": mfeStub.microFrontendId,
            ":v": targetVersion,
          },
          TableName: process.env.VERSION_STORE,
        })
        .resolves({ Items: [{}] });

      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetVersion: targetVersion,
          deploymentStrategy: "Linear10PercentEvery1Minute",
        }),
        pathParameters: {
          projectId: projectStub.projectId,
          microFrontendId: mfeStub.microFrontendId,
        },
      };
      await postDeploymentApi(event, {});
      fail("it should not reach here");
    } catch (error) {
      expect(error.message).toBe(
        "The target version is already the active version."
      );
      expect(error.statusCode).toBe(422);
    }
  });

  test("it throws if the target version does not exist when posting a deployment", async () => {
    try {
      const targetVersion = "3.0.0";
      ddbMock
        .on(QueryCommand, {
          KeyConditionExpression:
            "projectId = :project And microFrontendId = :microFrontendId",
          ExpressionAttributeValues: {
            ":project": projectStub.projectId,
            ":microFrontendId": mfeStub.microFrontendId,
          },
          TableName: process.env.FRONTEND_STORE,
        })
        .resolves({ Items: [mfeStub] })
        .on(QueryCommand, {
          KeyConditionExpression:
            "microFrontendId = :microFrontendId And version = :v",
          ExpressionAttributeValues: {
            ":microFrontendId": mfeStub.microFrontendId,
            ":v": targetVersion,
          },
          TableName: process.env.VERSION_STORE,
        })
        .resolves({ Items: [] });

      const event = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetVersion: targetVersion,
          deploymentStrategy: "Linear10PercentEvery1Minute",
        }),
        pathParameters: {
          projectId: projectStub.projectId,
          microFrontendId: mfeStub.microFrontendId,
        },
      };
      await postDeploymentApi(event, {});
      fail("it should not reach here");
    } catch (error) {
      expect(error.message).toBe("The specified version could not be found.");
      expect(error.statusCode).toBe(404);
    }
  });

  test("it deletes an existing deployment", async () => {
    ddbMock
      .on(QueryCommand, {
        KeyConditionExpression: "deploymentId = :deployment",
        ExpressionAttributeValues: {
          ":deployment": deploymentStub[0].deploymentId,
        },
        TableName: process.env.DEPLOYMENT_STORE,
      })
      .resolves({ Items: deploymentStub });

    const event = {
      headers: { "Content-Type": "application/json" },
      pathParameters: {
        projectId: projectStub.projectId,
        microFrontendId: mfeStub.microFrontendId,
        deploymentId: deploymentStub[0].deploymentId,
      },
    };
    const result = await deleteDeploymentApi(event, {});
    const initState = deploymentStub.find((i) => i.sk === "state#0");

    expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: process.env.FRONTEND_STORE,
      Key: {
        projectId: projectStub.projectId,
        microFrontendId: mfeStub.microFrontendId,
      },
      UpdateExpression:
        "set activeVersions = :v, #def = :d remove deploymentId",
      ExpressionAttributeValues: {
        ":v": initState.state.activeVersions,
        ":d": initState.state.default,
      },
      ExpressionAttributeNames: {
        "#def": "default",
      },
    });
    expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: process.env.DEPLOYMENT_STORE,
      Key: {
        deploymentId: deploymentStub[0].deploymentId,
        sk: "detail",
      },
      UpdateExpression: "set endedAt = :e, currentStatus = :s",
      ExpressionAttributeValues: {
        ":e": expect.any(String),
        ":s": "CANCELLED",
      },
    });
    expect(sfnMock).toHaveReceivedCommand(StopExecutionCommand);
    expect(result.statusCode).toBe(204);
  });
});
