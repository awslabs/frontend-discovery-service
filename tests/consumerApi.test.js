import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
const ddbMock = mockClient(DynamoDBDocumentClient);

import { getFrontends } from "../infrastructure/lambda/consumerApi/app";
import determineMFE from "../infrastructure/lambda/consumerApi/determineMFE";
jest.mock("../infrastructure/lambda/consumerApi/determineMFE");

process.env.CONSUMER_STORE = "consumer";

const view = require("./stubs/consumerView.json");

describe("AWS API Calls", () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  test("it gets frontends for a project", async () => {
    const returnVersionIndex = 0;
    determineMFE.mockReturnValueOnce(view.versions[returnVersionIndex]);

    ddbMock
      .on(QueryCommand, {
        KeyConditionExpression: "projectId = :project",
        ExpressionAttributeValues: {
          ":project": view.projectId,
        },
        TableName: process.env.CONSUMER_STORE,
      })
      .resolves({ Items: [view] });

    const event = {
      userId: 123,
      pathParameters: {
        projectId: view.projectId,
      },
    };

    const result = await getFrontends(event, {});
    const body = JSON.parse(result.body);

    expect(body).toStrictEqual({
      schema:
        "https://raw.githubusercontent.com/awslabs/frontend-discovery/main/schema/v1-pre.json",
      microFrontends: {
        [`${view.projectName}/${view.mfeName}`]: [
          view.versions[returnVersionIndex],
        ],
      },
    });
    expect(result.statusCode).toBe(200);
  });

  test("it throws if project does not exist", async () => {
    try {
      ddbMock
        .on(QueryCommand, {
          KeyConditionExpression: "projectId = :project",
          ExpressionAttributeValues: {
            ":project": view.projectId,
          },
          TableName: process.env.CONSUMER_STORE,
        })
        .resolves({ Items: [] });

      const event = {
        userId: 123,
        pathParameters: {
          projectId: view.projectId,
        },
      };
      await getFrontends(event, {});
      throw new Error(
        "The test should have triggered another error before now"
      );
    } catch (error) {
      expect(error.message).toBe("The specified project does not exist.");
      expect(error.statusCode).toBe(404);
    }
  });
});
