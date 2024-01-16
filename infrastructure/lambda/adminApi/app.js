import { DynamoDB } from "@aws-sdk/client-dynamodb";
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

import { Metrics } from "@aws-lambda-powertools/metrics";
import { Logger, injectLambdaContext } from "@aws-lambda-powertools/logger";
import { Tracer, captureLambdaHandler } from "@aws-lambda-powertools/tracer";

import { v4 as uuidv4 } from "uuid";

import middy from "@middy/core";
import httpRouterHandler from "@middy/http-router";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import httpErrorHandler from "@middy/http-error-handler";
import validator from "@middy/validator";
import createError from "http-errors";

import inputSchemas from "./inputSchemas";
import { getStates, Strategy } from "./deployment";

const metrics = new Metrics();
const logger = new Logger();
const tracer = new Tracer();

const dynamoClient = tracer.captureAWSv3Client(
  new DynamoDB({ region: process.env.REGION })
);
const sfnClient = tracer.captureAWSv3Client(
  new SFNClient({ region: process.env.REGION })
);
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const getProjectsApi = middy().handler(async (event, context) => {
  if (event.queryStringParameters) logger.debug(event.queryStringParameters);

  let params = {
    TableName: process.env.PROJECT_STORE,
  };

  if (event?.queryStringParameters?.startToken) {
    params.ExclusiveStartKey = {
      projectId: event.queryStringParameters.startToken,
    };
  }

  const dynamoData = await docClient.send(new ScanCommand(params));
  const result = {
    projects: dynamoData.Items.map((p) => {
      let resultItem = {
        id: p.projectId,
        name: p.name,
      };
      if (p.deleted) resultItem.deleted = p.deleted;
      return resultItem;
    }),
  };

  if (dynamoData.LastEvaluatedKey)
    result.nextToken = mfeList.LastEvaluatedKey.projectId;

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
});

export const postProjectsApi = middy()
  .use(httpJsonBodyParser())
  .use(validator({ inputSchema: inputSchemas.patchProject }))
  .handler(async (event, context) => {
    logger.debug(event.body);

    const projectName = event.body.name;
    const projectId = uuidv4();

    await docClient.send(
      new PutCommand(getPutProjectParams(projectId, projectName))
    );
    const result = { id: projectId, name: projectName };

    auditLog(event, { method: "CreateProject", projectId, statusCode: 201 });

    return {
      statusCode: 201,
      body: JSON.stringify(result),
    };
  });

export const patchProjectApi = middy()
  .use(httpJsonBodyParser())
  .use(validator({ inputSchema: inputSchemas.patchProject }))
  .handler(async (event, context) => {
    logger.debug(event.body);
    logger.debug(event.pathParameters);
    const projectId = event.pathParameters.projectId;
    const newProjectName = event.body.name;

    const project = await getProjectById(projectId);
    if (project.deleted) throw new createError.NotFound();

    await docClient.send(
      new PutCommand(getPutProjectParams(projectId, newProjectName))
    );
    const result = { id: projectId, name: newProjectName };

    auditLog(event, { method: "UpdateProject", projectId, statusCode: 200 });

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  });

export const getFrontendsApi = middy().handler(async (event, context) => {
  if (event.queryStringParameters) logger.debug(event.queryStringParameters);
  logger.debug(event.pathParameters);
  const projectId = event.pathParameters.projectId;
  let result = { projectId: projectId, microFrontends: [] };

  const promises = [
    getFrontendInfo(projectId, event?.queryStringParameters?.startToken),
    getProjectById(projectId),
  ];
  const [mfeList, project] = await Promise.all(promises);

  if (mfeList.LastEvaluatedKey)
    result.nextToken = mfeList.LastEvaluatedKey.microFrontendId;

  result.microFrontends = mfeList.Items.map((mfe) => {
    let resultItem = {
      name: `${project.name}/${mfe.name}`,
      id: mfe.microFrontendId,
      activeVersions: mfe.activeVersions,
    };
    if (mfe.deleted) resultItem.deleted = mfe.deleted;
    return resultItem;
  });

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
});

export const getFrontendVersionsApi = middy().handler(
  async (event, context) => {
    if (event.queryStringParameters) logger.debug(event.queryStringParameters);
    logger.debug(event.pathParameters);
    const { projectId, microFrontendId } = event.pathParameters;
    let result = {
      projectId: projectId,
      microFrontendId: microFrontendId,
      versions: [],
    };

    const promises = [
      getFrontendById(projectId, microFrontendId),
      getProjectById(projectId),
      getVersions(microFrontendId, event?.queryStringParameters?.startToken),
    ];
    const [mfe, project, versions] = await Promise.all(promises);

    if (versions.LastEvaluatedKey)
      result.nextToken = versions.LastEvaluatedKey.version;

    result.name = `${project.name}/${mfe.name}`;
    result.versions = versions.map((v) => v.data);
    result.activeVersions = mfe.activeVersions;

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  }
);

export const deleteProjectApi = middy().handler(async (event, context) => {
  logger.debug(event.pathParameters);
  const projectId = event.pathParameters.projectId;

  const now = Math.floor(Date.now() / 1000);
  const expirySeconds = 120;
  const recordExpiry = now + expirySeconds;
  const deleteParams = {
    TableName: process.env.PROJECT_STORE,
    Key: { projectId },
    UpdateExpression: "set deleted = :d, expiresAt = :e",
    ExpressionAttributeValues: {
      ":d": true,
      ":e": recordExpiry,
      ":p": projectId,
    },
    ConditionExpression: "projectId = :p",
  };

  let statusCode = 202;

  try {
    await docClient.send(new UpdateCommand(deleteParams));
  } catch (error) {
    statusCode = error.name === "ConditionalCheckFailedException" ? 404 : 500;
  }

  auditLog(event, { method: "DeleteProject", projectId, statusCode });
  return { statusCode };
});

export const deleteMicroFrontendApi = middy().handler(
  async (event, context) => {
    logger.debug(event.pathParameters);
    const { projectId, microFrontendId } = event.pathParameters;

    const now = Math.floor(Date.now() / 1000);
    const expirySeconds = process.env.DELETE_EXPIRY_MINUTES * 60;
    const recordExpiry = now + expirySeconds;
    const deleteParams = {
      TableName: process.env.FRONTEND_STORE,
      Key: { projectId, microFrontendId },
      UpdateExpression: "set deleted = :d, expiresAt = :e",
      ExpressionAttributeValues: {
        ":d": true,
        ":e": recordExpiry,
        ":p": projectId,
        ":m": microFrontendId,
      },
      ConditionExpression: "projectId = :p and microFrontendId = :m",
    };

    let statusCode = 202;

    try {
      await docClient.send(new UpdateCommand(deleteParams));
    } catch (error) {
      statusCode = error.name === "ConditionalCheckFailedException" ? 404 : 500;
    }

    auditLog(event, {
      method: "DeleteMicroFrontend",
      projectId,
      microFrontendId,
      statusCode,
    });

    return { statusCode };
  }
);

export const postMFEApi = middy()
  .use(httpJsonBodyParser())
  .use(validator({ inputSchema: inputSchemas.patchMFE }))
  .handler(async (event, context) => {
    logger.debug(event.body);
    logger.debug(event.pathParameters);
    const name = event.body.name;
    const projectId = event.pathParameters.projectId;
    const microFrontendId = uuidv4();

    await docClient.send(
      new PutCommand(
        getPutMicroFrontendParams(projectId, microFrontendId, name)
      )
    );
    const result = { microFrontendId, name };

    auditLog(event, {
      method: "CreateMicroFrontend",
      projectId,
      microFrontendId,
      statusCode: 201,
    });

    return {
      statusCode: 201,
      body: JSON.stringify(result),
    };
  });

export const patchMFEApi = middy()
  .use(httpJsonBodyParser())
  .use(validator({ inputSchema: inputSchemas.patchMFE }))
  .handler(async (event, context) => {
    logger.debug(event.body);
    logger.debug(event.pathParameters);
    const { projectId, microFrontendId } = event.pathParameters;
    const mfe = await getFrontendById(projectId, microFrontendId);

    if (mfe.deleted) throw new createError.NotFound();

    let activeVersions = mfe.activeVersions ?? [];
    if (event.body.activeVersions) {
      if (mfe.deploymentId)
        throw new createError.UnprocessableEntity(
          "There is an ongoing automated deployment."
        );
      await Promise.all(
        event.body.activeVersions.map((a) =>
          getVersion(mfe.microFrontendId, a.version)
        )
      );

      const sum = event.body.activeVersions.reduce(
        (n, { traffic }) => n + traffic,
        0
      );
      if (sum !== 100)
        throw new createError.UnprocessableEntity(
          `The total traffic for activeVersions should equal 100. Got ${sum}.`
        );

      activeVersions = event.body.activeVersions.filter((a) => a.traffic > 0);
    }

    const defaultVersion = event.body.default ?? mfe.default;
    if (defaultVersion) {
      const defaultItem = activeVersions.find(
        (v) => v.version === defaultVersion
      );
      if (!defaultItem)
        throw new createError.UnprocessableEntity(
          "The configured default is not one of the active versions."
        );
    }

    const params = {
      TableName: process.env.FRONTEND_STORE,
      Item: {
        projectId: projectId,
        microFrontendId: microFrontendId,
        name: event.body.name ?? mfe.name,
        activeVersions: activeVersions,
      },
    };

    if (defaultVersion) params.Item.default = defaultVersion;

    await docClient.send(new PutCommand(params));
    const result = {
      microFrontendId: microFrontendId,
      name: params.Item.name,
      activeVersions: activeVersions,
      default: defaultVersion,
    };

    auditLog(event, {
      method: "UpdateMicroFrontend",
      projectId,
      microFrontendId,
      statusCode: 200,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  });

export const postFrontendVersionApi = middy()
  .use(httpJsonBodyParser())
  .use(validator({ inputSchema: inputSchemas.postMFEVersion }))
  .handler(async (event, context) => {
    logger.debug(event.body);
    logger.debug(event.pathParameters);
    const { projectId, microFrontendId } = event.pathParameters;
    const { version, deploymentStrategy } = event.body;

    const result = { microFrontendId: microFrontendId, version: version };
    const mfe = await getFrontendById(projectId, microFrontendId);

    if (mfe.deleted) throw new createError.NotFound();

    if (deploymentStrategy) {
      await checkCanDeploy(mfe, null, false);
      if (mfe.activeVersions?.length > 1)
        throw new createError.UnprocessableEntity(
          "Unable to post a new version during an active deployment."
        );
    }

    await docClient.send(
      new PutCommand(getPutMicroFrontendVersionParams(microFrontendId, version))
    );
    if (deploymentStrategy) {
      result.deploymentId = await initiateDeployment(
        mfe,
        version.metadata.version,
        deploymentStrategy
      );
    }

    if (!deploymentStrategy && mfe.activeVersions.length === 0) {
      const mfeParams = {
        TableName: process.env.FRONTEND_STORE,
        Key: {
          projectId: projectId,
          microFrontendId: microFrontendId,
        },
        UpdateExpression: "set activeVersions = :v, #def = :d",
        ExpressionAttributeValues: {
          ":v": [{ version: version.metadata.version, traffic: 100 }],
          ":d": version.metadata.version,
        },
        ExpressionAttributeNames: {
          "#def": "default",
        },
      };
      await docClient.send(new UpdateCommand(mfeParams));
    }

    auditLog(event, {
      method: "CreateVersion",
      projectId,
      microFrontendId,
      version: version.metadata.version,
      statusCode: 201,
    });

    return {
      statusCode: 201,
      body: JSON.stringify(result),
    };
  });

export const postDeploymentApi = middy()
  .use(httpJsonBodyParser())
  .use(validator({ inputSchema: inputSchemas.postDeployment }))
  .handler(async (event, context) => {
    logger.debug(event.body);
    logger.debug(event.pathParameters);
    const { projectId, microFrontendId } = event.pathParameters;
    const { targetVersion, deploymentStrategy } = event.body;
    const mfe = await getFrontendById(projectId, microFrontendId);

    if (mfe.deleted) throw new createError.NotFound();

    await checkCanDeploy(mfe, targetVersion);
    const deploymentId = await initiateDeployment(
      mfe,
      targetVersion,
      deploymentStrategy
    );

    auditLog(event, {
      method: "CreateDeployment",
      projectId,
      microFrontendId,
      deploymentId,
      statusCode: 201,
    });

    return {
      statusCode: 201,
      body: JSON.stringify({ deploymentId: deploymentId }),
    };
  });

export const deleteDeploymentApi = middy().handler(async (event, context) => {
  logger.debug(event.pathParameters);
  const { projectId, microFrontendId, deploymentId } = event.pathParameters;
  let deploymentItems;

  try {
    deploymentItems = await getDeploymentById(deploymentId);
  } catch (error) {
    auditLog(event, {
      method: "DeleteDeployment",
      projectId,
      microFrontendId,
      deploymentId,
      statusCode: 404,
    });
    return { statusCode: 404 };
  }

  const initState = deploymentItems.find((i) => i.sk === "state#0");

  await sfnClient.send(
    new StopExecutionCommand({
      cause: "Deployment was cancelled using DELETE endpoint.",
      executionArn: `arn:aws:states:${process.env.REGION}:${process.env.ACCOUNT_ID}:execution:${process.env.DEPLOYMENT_STATE_MACHINE_NAME}:${deploymentId}`,
    })
  );

  const mfeParams = {
    TableName: process.env.FRONTEND_STORE,
    Key: {
      projectId: projectId,
      microFrontendId: microFrontendId,
    },
    UpdateExpression: "set activeVersions = :v, #def = :d remove deploymentId",
    ExpressionAttributeValues: {
      ":v": initState.state.activeVersions,
      ":d": initState.state.default,
    },
    ExpressionAttributeNames: {
      "#def": "default",
    },
  };
  await docClient.send(new UpdateCommand(mfeParams));

  const deploymentParams = {
    TableName: process.env.DEPLOYMENT_STORE,
    Key: {
      deploymentId: deploymentId,
      sk: "detail",
    },
    UpdateExpression: "set endedAt = :e, currentStatus = :s",
    ExpressionAttributeValues: {
      ":e": new Date().toISOString(),
      ":s": "CANCELLED",
    },
  };
  await docClient.send(new UpdateCommand(deploymentParams));

  auditLog(event, {
    method: "DeleteDeployment",
    projectId,
    microFrontendId,
    deploymentId,
    statusCode: 204,
  });

  return { statusCode: 204 };
});

export const checkCanDeploy = async (
  mfe,
  targetVersion = null,
  validateTarget = true
) => {
  if (mfe.deploymentId)
    throw new createError.UnprocessableEntity(
      "There is an existing automated deployment."
    );

  const currentVersion = mfe.activeVersions.find((v) => v.traffic === 100);
  if (!currentVersion)
    throw new createError.UnprocessableEntity(
      "Unable to create deployment when no existing version is currently receiving 100% traffic."
    );

  if (validateTarget) {
    if (currentVersion.version == targetVersion)
      throw new createError.UnprocessableEntity(
        "The target version is already the active version."
      );
    await getVersion(mfe.microFrontendId, targetVersion);
  }
};

export const initiateDeployment = async (
  mfe,
  targetVersion,
  deploymentStrategy
) => {
  const states = getStates(mfe, targetVersion, Strategy[deploymentStrategy]);
  const deploymentId = uuidv4();

  const now = Math.floor(Date.now() / 1000);
  const stateExpiry =
    Strategy[deploymentStrategy].waitMinutes * 60 * states.length + now + 3600;

  const params = {
    RequestItems: {
      [process.env.DEPLOYMENT_STORE]: states.map((item, index) => {
        return {
          PutRequest: {
            Item: {
              deploymentId: deploymentId,
              sk: `state#${index}`,
              state: item,
              expiresAt: stateExpiry,
            },
          },
        };
      }),
    },
  };
  params.RequestItems[process.env.DEPLOYMENT_STORE].push({
    PutRequest: {
      Item: {
        deploymentId: deploymentId,
        sk: "detail",
        currentState: 0,
        microFrontendId: mfe.microFrontendId,
        projectId: mfe.projectId,
        expiresAt: stateExpiry + 86400,
        currentStatus: "STARTED",
      },
    },
  });

  await docClient.send(new BatchWriteCommand(params));

  const stepInput = {
    mfeTable: process.env.FRONTEND_STORE,
    deploymentTable: process.env.DEPLOYMENT_STORE,
    mfeId: mfe.microFrontendId,
    projectId: mfe.projectId,
    waitSeconds: Strategy[deploymentStrategy].waitMinutes * 60,
    endIndex: states.length - 1,
  };
  await sfnClient.send(
    new StartExecutionCommand({
      input: JSON.stringify(stepInput),
      name: deploymentId,
      stateMachineArn: process.env.DEPLOYMENT_STATE_MACHINE_ARN,
    })
  );

  return deploymentId;
};

const getPutProjectParams = (projectId, projectName) => {
  return {
    TableName: process.env.PROJECT_STORE,
    Item: {
      projectId: projectId,
      name: projectName,
    },
  };
};

const getPutMicroFrontendParams = (projectId, microFrontendId, name) => {
  return {
    TableName: process.env.FRONTEND_STORE,
    Item: {
      projectId: projectId,
      microFrontendId: microFrontendId,
      name: name,
      activeVersions: [],
    },
  };
};

const getPutMicroFrontendVersionParams = (microFrontendId, version) => {
  return {
    TableName: process.env.VERSION_STORE,
    Item: {
      microFrontendId: microFrontendId,
      version: version.metadata.version,
      data: version,
    },
  };
};

export const getProjectById = async (projectId) => {
  const params = {
    KeyConditionExpression: "projectId = :project",
    ExpressionAttributeValues: {
      ":project": projectId,
    },
    TableName: process.env.PROJECT_STORE,
  };
  const result = await docClient.send(new QueryCommand(params));
  if (result.Items.length == 0) throw new createError.NotFound();

  return result.Items[0];
};

export const getFrontendInfo = async (projectId, startToken) => {
  let params = {
    KeyConditionExpression: "projectId = :project",
    ExpressionAttributeValues: {
      ":project": projectId,
    },
    TableName: process.env.FRONTEND_STORE,
  };

  if (startToken)
    params.ExclusiveStartKey = {
      projectId: projectId,
      frontendId: startToken,
    };

  return await docClient.send(new QueryCommand(params));
};

export const getFrontendById = async (projectId, microFrontendId) => {
  let params = {
    KeyConditionExpression:
      "projectId = :project And microFrontendId = :microFrontendId",
    ExpressionAttributeValues: {
      ":project": projectId,
      ":microFrontendId": microFrontendId,
    },
    TableName: process.env.FRONTEND_STORE,
  };

  const result = await docClient.send(new QueryCommand(params));
  if (result.Items.length == 0) throw new createError.NotFound();

  return result.Items[0];
};

export const getDeploymentById = async (deploymentId) => {
  let params = {
    KeyConditionExpression: "deploymentId = :deployment",
    ExpressionAttributeValues: {
      ":deployment": deploymentId,
    },
    TableName: process.env.DEPLOYMENT_STORE,
  };
  const result = await docClient.send(new QueryCommand(params));

  if (result.Items.length == 0)
    throw new createError.NotFound(
      "The specified deployment could not be found."
    );

  return result.Items;
};

export const getVersions = async (microFrontendId, startToken) => {
  let params = {
    KeyConditionExpression: "microFrontendId = :microFrontendId",
    ExpressionAttributeValues: {
      ":microFrontendId": microFrontendId,
    },
    TableName: process.env.VERSION_STORE,
  };

  if (startToken)
    params.ExclusiveStartKey = {
      projectId: projectId,
      version: startToken,
    };

  const result = await docClient.send(new QueryCommand(params));
  return result.Items;
};

export const getVersion = async (microFrontendId, version) => {
  let params = {
    KeyConditionExpression:
      "microFrontendId = :microFrontendId And version = :v",
    ExpressionAttributeValues: {
      ":microFrontendId": microFrontendId,
      ":v": version,
    },
    TableName: process.env.VERSION_STORE,
  };

  const result = await docClient.send(new QueryCommand(params));
  if (result.Items.length == 0)
    throw new createError.NotFound("The specified version could not be found.");
  return result.Items[0];
};

export const getUserInfo = (event) => {
  return {
    user:
      event.requestContext?.authorizer?.claims["cognito:username"] ?? "Unknown",
    ipAddress: event.requestContext?.identity?.sourceIp ?? "Unknown",
  };
};

const auditLog = (event, logData) => {
  logger[logData.statusCode < 400 ? "info" : "error"]({
    audit: { ...getUserInfo(event), ...logData },
  });
};

const routes = [
  {
    method: "GET",
    path: "/projects",
    handler: getProjectsApi,
  },
  {
    method: "POST",
    path: "/projects",
    handler: postProjectsApi,
  },
  {
    method: "PATCH",
    path: "/projects/{projectId}",
    handler: patchProjectApi,
  },
  {
    method: "DELETE",
    path: "/projects/{projectId}",
    handler: deleteProjectApi,
  },
  {
    method: "GET",
    path: "/projects/{projectId}/microFrontends",
    handler: getFrontendsApi,
  },
  {
    method: "DELETE",
    path: "/projects/{projectId}/microFrontends/{microFrontendId}",
    handler: deleteMicroFrontendApi,
  },
  {
    method: "GET",
    path: "/projects/{projectId}/microFrontends/{microFrontendId}/versions",
    handler: getFrontendVersionsApi,
  },
  {
    method: "POST",
    path: "/projects/{projectId}/microFrontends",
    handler: postMFEApi,
  },
  {
    method: "PATCH",
    path: "/projects/{projectId}/microFrontends/{microFrontendId}",
    handler: patchMFEApi,
  },
  {
    method: "POST",
    path: "/projects/{projectId}/microFrontends/{microFrontendId}/versions",
    handler: postFrontendVersionApi,
  },
  {
    method: "POST",
    path: "/projects/{projectId}/microFrontends/{microFrontendId}/deployment",
    handler: postDeploymentApi,
  },
  {
    method: "DELETE",
    path: "/projects/{projectId}/microFrontends/{microFrontendId}/deployment/{deploymentId}",
    handler: deleteDeploymentApi,
  },
];

export const handler = middy()
  .use(httpErrorHandler())
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger))
  .handler(httpRouterHandler(routes));
