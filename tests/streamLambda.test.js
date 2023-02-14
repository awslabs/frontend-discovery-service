import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
const ddbMock = mockClient(DynamoDBDocumentClient);

import {
  handleUpdateProject,
  handleUpdateFrontend,
} from "../infrastructure/lambda/stream/app";

process.env.FRONTEND_STORE = "frontend";
process.env.PROJECT_STORE = "project";
process.env.CONSUMER_STORE = "consumer";
process.env.VERSION_STORE = "version";

const viewStub = require("./stubs/consumerView.json");
const versionsStub = require("./stubs/versions.json");
const projectStub = require("./stubs/project.json");
const mfeStub = require("./stubs/mfe.json");

describe("Stream lambda", () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  test("updating project batches appropriately", async () => {
    ddbMock
      .on(QueryCommand, {
        KeyConditionExpression: "projectId = :project",
        ExpressionAttributeValues: {
          ":project": viewStub.projectId,
        },
        TableName: process.env.CONSUMER_STORE,
      })
      .resolves({ Items: [...Array(30).map((x) => ({}))] });

    const record = {
      dynamodb: {
        Keys: { projectId: { S: viewStub.projectId } },
        NewImage: { name: { S: "new name" } },
      },
    };

    await handleUpdateProject(record);
    expect(ddbMock).toHaveReceivedCommandTimes(BatchWriteCommand, 2);
  });

  test("a frontend marked as deleted is removed from the consumer store and marks versions as deleted", async () => {
    ddbMock
      .on(QueryCommand, {
        KeyConditionExpression: "microFrontendId = :microFrontendId",
        ExpressionAttributeValues: {
          ":microFrontendId": viewStub.microFrontendId,
        },
        TableName: process.env.VERSION_STORE,
      })
      .resolves({ Items: [versionsStub] });

    const record = {
      dynamodb: {
        Keys: {
          projectId: { S: viewStub.projectId },
          microFrontendId: { S: viewStub.microFrontendId },
        },
        NewImage: { deleted: { BOOL: true }, expiresAt: { N: 123 } },
      },
    };

    await handleUpdateFrontend(record);
    expect(ddbMock).toHaveReceivedCommandWith(DeleteCommand, {
      TableName: process.env.CONSUMER_STORE,
      Key: {
        projectId: viewStub.projectId,
        microFrontendId: viewStub.microFrontendId,
      },
    });
    expect(ddbMock).toHaveReceivedCommandWith(BatchWriteCommand, {
      RequestItems: {
        [process.env.VERSION_STORE]: [
          {
            PutRequest: {
              Item: {
                ...versionsStub,
                ...{
                  expiresAt: expect.any(Number),
                  deleted: true,
                  deleteMode: "mfe",
                },
              },
            },
          },
        ],
      },
    });
  });

  test("an updated project generates a updated consumer views", async () => {
    const newName = "new project name";
    ddbMock
      .on(QueryCommand, {
        KeyConditionExpression: "projectId = :project",
        ExpressionAttributeValues: {
          ":project": projectStub.projectId,
        },
        TableName: process.env.CONSUMER_STORE,
      })
      .resolves({ Items: [viewStub] });

    const record = {
      dynamodb: {
        Keys: {
          projectId: { S: viewStub.projectId },
        },
        NewImage: { name: { S: newName } },
      },
    };

    await handleUpdateProject(record);
    expect(ddbMock).toHaveReceivedCommandWith(BatchWriteCommand, {
      RequestItems: {
        [process.env.CONSUMER_STORE]: [
          {
            PutRequest: {
              Item: { ...viewStub, ...{ projectName: newName } },
            },
          },
        ],
      },
    });
  });

  test("an updated frontend generates an updated consumer view", async () => {
    const activeVersion = versionsStub.Items.find(
      (i) => i.version === mfeStub.activeVersions[0].version
    );
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
        KeyConditionExpression:
          "microFrontendId = :microFrontendId And version = :v",
        ExpressionAttributeValues: {
          ":microFrontendId": mfeStub.microFrontendId,
          ":v": mfeStub.activeVersions[0].version,
        },
        TableName: process.env.VERSION_STORE,
      })
      .resolves({ Items: [activeVersion] });

    const record = {
      dynamodb: {
        Keys: {
          projectId: { S: viewStub.projectId },
          microFrontendId: { S: viewStub.microFrontendId },
        },
        NewImage: {
          activeVersions: {
            L: [
              {
                M: {
                  traffic: {
                    N: "100",
                  },
                  version: {
                    S: activeVersion.version,
                  },
                },
              },
            ],
          },
        },
      },
    };

    const expectedView = {
      projectId: projectStub.projectId,
      microFrontendId: mfeStub.microFrontendId,
      projectName: projectStub.name,
      mfeName: mfeStub.name,
      versions: [
        {
          ...versionsStub.Items[1].data,
          ...{
            deployment: {
              traffic: 100,
              default: true,
            },
          },
        },
      ],
    };

    await handleUpdateFrontend(record);
    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: process.env.CONSUMER_STORE,
      Item: expectedView,
    });
  });

  test("a project marked as deleted marks all other items as deleted and removes all consumer views", async () => {
    ddbMock
      .on(QueryCommand, {
        KeyConditionExpression: "projectId = :project",
        ExpressionAttributeValues: {
          ":project": viewStub.projectId,
        },
        TableName: process.env.CONSUMER_STORE,
      })
      .resolves({ Items: [viewStub] })
      .on(QueryCommand, {
        KeyConditionExpression: "projectId = :project",
        ExpressionAttributeValues: {
          ":project": projectStub.projectId,
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

    const record = {
      dynamodb: {
        Keys: { projectId: { S: viewStub.projectId } },
        NewImage: { deleted: { BOOL: true }, expiresAt: { N: 123 } },
      },
    };

    await handleUpdateProject(record);
    expect(ddbMock).toHaveReceivedCommandWith(BatchWriteCommand, {
      RequestItems: {
        [process.env.CONSUMER_STORE]: [
          {
            DeleteRequest: {
              Key: {
                projectId: viewStub.projectId,
                microFrontendId: viewStub.microFrontendId,
              },
            },
          },
        ],
      },
    });
    expect(ddbMock).toHaveReceivedCommandWith(BatchWriteCommand, {
      RequestItems: {
        [process.env.FRONTEND_STORE]: [
          {
            PutRequest: {
              Item: {
                ...mfeStub,
                ...{
                  expiresAt: expect.any(Number),
                  deleted: true,
                  deleteMode: "project",
                },
              },
            },
          },
        ],
      },
    });
    expect(ddbMock).toHaveReceivedCommandWith(BatchWriteCommand, {
      RequestItems: {
        [process.env.VERSION_STORE]: [
          {
            PutRequest: {
              Item: {
                ...versionsStub.Items[0],
                ...{
                  expiresAt: expect.any(Number),
                  deleted: true,
                  deleteMode: "project",
                },
              },
            },
          },
          {
            PutRequest: {
              Item: {
                ...versionsStub.Items[1],
                ...{
                  expiresAt: expect.any(Number),
                  deleted: true,
                  deleteMode: "project",
                },
              },
            },
          },
        ],
      },
    });
  });
});
