import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { Metrics } from "@aws-lambda-powertools/metrics";
import { Logger, injectLambdaContext } from "@aws-lambda-powertools/logger";
import { Tracer, captureLambdaHandler } from "@aws-lambda-powertools/tracer";

import middy from "@middy/core";
import httpRouterHandler from "@middy/http-router";
import httpErrorHandler from "@middy/http-error-handler";
import cors from "@middy/http-cors";
import createError from "http-errors";

import userTrackingHandler from "./userTrackingHandler";
import determineMFE from "./determineMFE";

const metrics = new Metrics();
const logger = new Logger();
const tracer = new Tracer();

const dynamoClient = tracer.captureAWSv3Client(
  new DynamoDB({ region: process.env.REGION })
);
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const getFrontends = middy().handler(async (event, context) => {
  logger.debug(event);
  let result = {
    schema: "https://mfewg.org/schema/v1-pre.json",
    microFrontends: {},
  };

  const userId = event.userId;
  const projectId = event.pathParameters.projectId;
  const mfeList = await getProjectFrontends(
    projectId,
    event?.queryStringParameters?.startToken
  );

  if (mfeList.LastEvaluatedKey)
    result.nextToken = mfeList.LastEvaluatedKey.microFrontendId;

  mfeList.Items.forEach((mfe) => {
    if (!mfe.versions) return;
    let mfeResult = determineMFE(mfe, userId);
    delete mfeResult.deployment;
    result.microFrontends[`${mfe.projectName}/${mfe.mfeName}`] = [mfeResult];
  });

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
});

const getProjectFrontends = async (projectId, startToken) => {
  let params = {
    KeyConditionExpression: "projectId = :project",
    ExpressionAttributeValues: {
      ":project": projectId,
    },
    TableName: process.env.CONSUMER_STORE,
  };

  if (startToken)
    params.ExclusiveStartKey = {
      projectId: projectId,
      microFrontendId: startToken,
    };

  const result = await docClient.send(new QueryCommand(params));
  if (result.Items.length == 0)
    throw new createError.NotFound("The specified project does not exist.");
  return result;
};

const routes = [
  {
    method: "GET",
    path: "/projects/{projectId}/microFrontends",
    handler: getFrontends,
  },
];

export const handler = middy()
  .use(httpErrorHandler())
  .handler(httpRouterHandler(routes))
  .use(cors({ origin: process.env.ALLOW_ORIGIN }))
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .use(userTrackingHandler());